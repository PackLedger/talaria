import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { LoginScreen } from '@/components/auth/login-screen'
import { MercuryBackdrop } from '@/components/mercury-backdrop'
import { useSession } from '@/lib/session'

const SearchSchema = z.object({ error: z.string().optional() })

export const Route = createFileRoute('/login')({
  validateSearch: SearchSchema,
  component: LoginPage,
})

function LoginPage() {
  const { error } = Route.useSearch()
  const { data: user, isSuccess } = useSession()
  const navigate = useNavigate()

  // Already signed in → straight to the cockpit.
  useEffect(() => {
    if (isSuccess && user) void navigate({ to: '/' })
  }, [isSuccess, user, navigate])

  return (
    <>
      <MercuryBackdrop />
      <LoginScreen error={error} />
    </>
  )
}
