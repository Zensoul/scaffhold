import { CenteredPage } from '@/components/shared/page-layout'

export default function ConsentRequiredPage() {
  return (
    <CenteredPage maxWidth={480}>
      <h1 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem', color: '#111' }}>
        Parental consent needed
      </h1>
      <p style={{ color: '#111', marginBottom: '0.75rem' }}>
        Before you can start practicing, a parent or guardian needs to confirm consent for
        your account.
      </p>
      <p style={{ fontSize: '0.85rem', color: '#666' }}>
        Ask your parent to register on Scaffhold and add you as their child — they'll get a
        link to share with you to finish setting up your account.
      </p>
    </CenteredPage>
  )
}