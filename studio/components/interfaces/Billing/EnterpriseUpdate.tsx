import { FC, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Transition } from '@headlessui/react'

import { useStore } from 'hooks'
import { getURL } from 'lib/helpers'
import { post, patch } from 'lib/common/fetch'
import { API_URL, PROJECT_STATUS } from 'lib/constants'

import Divider from 'components/ui/Divider'
import { DatabaseAddon } from './AddOns/AddOns.types'
import { formatComputeSizes, formatPITROptions } from './AddOns/AddOns.utils'
import {
  AddNewPaymentMethodModal,
  ComputeSizeSelection,
  PITRDurationSelection,
  StripeSubscription,
  PaymentSummaryPanel,
  UpdateSuccess,
} from './'
import { PaymentMethod, SubscriptionPreview } from './Billing.types'
import { formSubscriptionUpdatePayload, getCurrentAddons } from './Billing.utils'

interface Props {
  products: { tiers: any[]; addons: DatabaseAddon[] }
  paymentMethods?: PaymentMethod[]
  currentSubscription: StripeSubscription
  isLoadingPaymentMethods: boolean
}

const EnterpriseUpdate: FC<Props> = ({
  products,
  paymentMethods,
  currentSubscription,
  isLoadingPaymentMethods,
}) => {
  const { app, ui } = useStore()
  const router = useRouter()

  const projectId = ui.selectedProject?.id ?? -1
  const projectRef = ui.selectedProject?.ref ?? 'default'
  const projectRegion = ui.selectedProject?.region ?? ''

  const { addons } = products
  const computeSizes = formatComputeSizes(addons)
  const pitrDurationOptions = formatPITROptions(addons)
  const { currentComputeSize, currentPITRDuration } = getCurrentAddons(currentSubscription, addons)

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<any>()
  const [selectedComputeSize, setSelectedComputeSize] = useState<DatabaseAddon>(currentComputeSize)
  const [selectedPITRDuration, setSelectedPITRDuration] =
    useState<DatabaseAddon>(currentPITRDuration)
  const [subscriptionPreview, setSubscriptionPreview] = useState<SubscriptionPreview>()

  const [isRefreshingPreview, setIsRefreshingPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccessful, setIsSuccessful] = useState(false)
  const [showAddPaymentMethodModal, setShowAddPaymentMethodModal] = useState(false)

  const isChangingComputeSize = currentComputeSize?.id !== selectedComputeSize.id

  useEffect(() => {
    getSubscriptionPreview()
  }, [selectedComputeSize, selectedPITRDuration])

  useEffect(() => {
    if (!isLoadingPaymentMethods && paymentMethods && paymentMethods.length > 0) {
      setSelectedPaymentMethodId(paymentMethods[0].id)
    }
  }, [isLoadingPaymentMethods, paymentMethods])

  const getSubscriptionPreview = async () => {
    // For enterprise, only tier will be fixed based on current subscription
    // Only allow add-ons changing
    const payload = {
      ...formSubscriptionUpdatePayload(
        null,
        selectedComputeSize,
        selectedPITRDuration,
        selectedPaymentMethodId,
        projectRegion
      ),
      tier: currentSubscription.tier.price_id,
    }

    setIsRefreshingPreview(true)
    const preview = await post(`${API_URL}/projects/${projectRef}/subscription/preview`, payload)
    if (preview.error) {
      ui.setNotification({
        category: 'error',
        message: `Failed to fetch subscription preview: ${preview.error.message}`,
      })
    }
    setSubscriptionPreview(preview)
    setIsRefreshingPreview(false)
  }

  // Last todo to support enterprise billing on dashboard + E2E test
  const onConfirmPayment = async () => {
    const payload = {
      ...formSubscriptionUpdatePayload(
        null,
        selectedComputeSize,
        selectedPITRDuration,
        selectedPaymentMethodId,
        projectRegion
      ),
      tier: currentSubscription.tier.price_id,
    }

    setIsSubmitting(true)
    const res = await patch(`${API_URL}/projects/${projectRef}/subscription`, payload)
    if (res?.error) {
      ui.setNotification({
        category: 'error',
        message: `Failed to update subscription: ${res?.error?.message}`,
      })
    } else {
      if (isChangingComputeSize) {
        app.onProjectStatusUpdated(projectId, PROJECT_STATUS.RESTORING)
        ui.setNotification({
          category: 'success',
          message:
            'Your project has been updated and is currently restarting to update its instance size',
          duration: 8000,
        })
        router.push(`/project/${projectRef}`)
      } else {
        setIsSuccessful(true)
      }
    }
    setIsSubmitting(false)
  }

  if (!isSubmitting && isSuccessful) {
    return (
      <UpdateSuccess
        projectRef={projectRef || ''}
        title="Your project has been updated!"
        message="Let us know if you have any feedback at sales@supabase.io."
      />
    )
  }

  return (
    <>
      <Transition
        show
        enter="transition ease-out duration-300"
        enterFrom="transform opacity-0 translate-x-10"
        enterTo="transform opacity-100 translate-x-0"
        className="flex w-full items-start justify-between"
      >
        <div className="2xl:min-w-5xl mx-auto mt-10 px-32">
          <div className="relative space-y-4">
            <div className="space-y-8">
              <h4 className="text-scale-900 text-lg">Change your project's subscription</h4>
              <div
                className="space-y-8 overflow-scroll pb-8"
                style={{ height: 'calc(100vh - 6.4rem - 57px)' }}
              >
                <h3 className="text-xl">
                  Managing your <span className="text-brand-900">Enterprise</span> plan
                </h3>
                <div
                  className={[
                    'bg-panel-body-light dark:bg-panel-body-dark border-panel-border-light border-panel-border-dark',
                    'flex max-w-[600px] items-center justify-between gap-16 rounded border px-6 py-4 drop-shadow-sm',
                  ].join(' ')}
                >
                  <p className="text-sm">
                    If you'd like to change your subscription away from enterprise, please reach out
                    to <span className="text-brand-900">enterprise@supabase.io</span> with your
                    request.
                  </p>
                </div>
                {projectRegion !== 'af-south-1' && (
                  <>
                    {pitrDurationOptions.length > 0 && (
                      <>
                        <Divider light />
                        <PITRDurationSelection
                          pitrDurationOptions={pitrDurationOptions}
                          currentPitrDuration={currentPITRDuration}
                          selectedPitrDuration={selectedPITRDuration}
                          onSelectOption={setSelectedPITRDuration}
                        />
                      </>
                    )}
                    <Divider light />
                    <ComputeSizeSelection
                      computeSizes={computeSizes || []}
                      currentComputeSize={currentComputeSize}
                      selectedComputeSize={selectedComputeSize}
                      onSelectOption={setSelectedComputeSize}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="w-[34rem]">
          <PaymentSummaryPanel
            isSpendCapEnabled={true}
            isSubmitting={isSubmitting}
            isRefreshingPreview={isRefreshingPreview}
            subscriptionPreview={subscriptionPreview}
            // Current subscription configuration based on DB
            currentPlan={currentSubscription.tier}
            currentComputeSize={currentComputeSize}
            currentPITRDuration={currentPITRDuration}
            // Selected subscription configuration based on UI
            selectedComputeSize={selectedComputeSize}
            selectedPITRDuration={selectedPITRDuration}
            paymentMethods={paymentMethods}
            isLoadingPaymentMethods={isLoadingPaymentMethods}
            selectedPaymentMethod={selectedPaymentMethodId}
            onSelectPaymentMethod={setSelectedPaymentMethodId}
            onSelectAddNewPaymentMethod={() => {
              setShowAddPaymentMethodModal(true)
            }}
            onConfirmPayment={onConfirmPayment}
          />
        </div>
      </Transition>

      <AddNewPaymentMethodModal
        visible={showAddPaymentMethodModal}
        returnUrl={`${getURL()}/project/${projectRef}/settings/billing/update/pro`}
        onCancel={() => setShowAddPaymentMethodModal(false)}
      />
    </>
  )
}

export default EnterpriseUpdate
