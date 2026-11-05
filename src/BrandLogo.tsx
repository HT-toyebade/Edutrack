interface BrandLogoProps {
  size: 'large' | 'compact'
}

function BrandLogo({ size }: BrandLogoProps) {
  return (
    <img
      className={`brand-logo brand-logo--${size}`}
      src="/edutrack-brand-v3.png"
      alt="EduTrack"
    />
  )
}

export default BrandLogo
