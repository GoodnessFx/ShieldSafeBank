export default function BrandMark({ height = 32, white = false }: { height?: number; white?: boolean }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}shield-safe-bank-logo.png`}
      alt="Shield Safe Bank"
      style={{ height, width: 'auto', display: 'block', filter: white ? 'brightness(0) invert(1)' : 'none' }}
    />
  );
}
