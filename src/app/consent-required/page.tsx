import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'

export default function ConsentRequiredPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold tracking-tight">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
          S
        </span>
        <span className="text-base">Scaffhold</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardContent className="py-6">
          <h1 className="mb-3 text-lg font-semibold text-foreground">Parental consent needed</h1>
          <p className="mb-3 text-sm text-foreground">
            Before you can start practicing, a parent or guardian needs to confirm consent for
            your account.
          </p>
          <p className="text-sm text-muted-foreground">
            Ask your parent to register on Scaffhold and add you as their child — they&apos;ll get
            a link to share with you to finish setting up your account.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
