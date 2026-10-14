import logo from '../../assets/logo.png';

interface BrandLoaderProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  inline?: boolean;
  tone?: 'light' | 'dark';
  className?: string;
}

const sizeClasses = {
  sm: 'brand-loader--sm',
  md: 'brand-loader--md',
  lg: 'brand-loader--lg',
};

const BrandLoader = ({
  label = 'Cargando...',
  size = 'md',
  inline = false,
  tone = 'light',
  className = '',
}: BrandLoaderProps) => (
  <span
    role="status"
    className={`brand-loader ${sizeClasses[size]} ${tone === 'dark' ? 'brand-loader--dark' : 'brand-loader--light'} ${inline ? 'brand-loader--inline' : ''} ${className}`}
  >
    <span className="brand-loader__mark" aria-hidden="true">
      <span className="brand-loader__ring" />
      <img src={logo} alt="" className="brand-loader__logo" />
    </span>
    <span className="brand-loader__label">{label}</span>
  </span>
);

export default BrandLoader;
