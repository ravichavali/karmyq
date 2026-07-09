import { useEffect, useState } from 'react'

interface WelcomeModalProps {
  user: { id: string; name?: string } | null
}

const STEPS = [
  {
    title: 'Welcome to Karmyq!',
    body: 'Karmyq connects you with neighbours who help each other out — rides, borrowed tools, childcare, home repairs. No money changes hands. Just community.',
  },
  {
    title: 'Join a community',
    body: 'Find a local community near you, or create one for your street, building, or group. Communities are where everything happens.',
  },
  {
    title: 'Ask for help or offer it',
    body: "Post what you need, or browse what others are asking for and lend a hand. Every exchange builds trust — and that's how communities grow.",
  },
]

export default function WelcomeModal({ user }: WelcomeModalProps) {
  const [visible, setVisible] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)

  useEffect(() => {
    // Sprint 118 (ADR-085): the gate is user-scoped (written by the /welcome arrival moment or by
    // closing this modal). The legacy browser-global key is still honored so existing users see
    // nothing new.
    if (
      user &&
      !localStorage.getItem(`karmyq_onboarded:${user.id}`) &&
      !localStorage.getItem('karmyq_onboarded')
    ) {
      setVisible(true)
    }
  }, [user])

  if (!visible) return null

  const current = STEPS[step - 1]
  const isLast = step === 3

  function handleNext() {
    if (step < 3) setStep((step + 1) as 1 | 2 | 3)
  }

  function handleClose() {
    if (user) localStorage.setItem(`karmyq_onboarded:${user.id}`, '1')
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      <div className="card p-8 max-w-md w-full mx-4 relative z-10">
        <h2 className="text-xl font-semibold text-text mb-3">{current.title}</h2>
        <p className="text-text-muted text-sm leading-relaxed">{current.body}</p>

        {/* Step dots */}
        <div className="flex justify-center gap-2 mt-6 mb-6">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`rounded-full w-2 h-2 ${i + 1 === step ? 'bg-primary' : 'bg-border'}`}
            />
          ))}
        </div>

        <div className="flex justify-between items-center">
          <button onClick={handleClose} className="btn-ghost text-sm">
            Skip
          </button>
          {isLast ? (
            <button onClick={handleClose} className="btn-primary">
              Browse my feed
            </button>
          ) : (
            <button onClick={handleNext} className="btn-primary">
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
