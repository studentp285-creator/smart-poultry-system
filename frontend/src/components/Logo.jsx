export default function Logo({ size = 40, plain = false, className = '' }) {
  return (
    <img
      src="/chicken-logo.jpg"
      alt="Smart Poultry"
      style={{ width: size, height: size }}
      className={`object-cover object-center ${plain ? 'rounded-full' : ''} ${className}`}
    />
  )
}
