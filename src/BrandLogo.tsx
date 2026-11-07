import "./BrandLogo.css";
export default function BrandLogo({ className = "" }: { className?: string }) {
  return <span className={"m8-brand-logo " + className}><img src={import.meta.env.BASE_URL + "m8m8s-logo.png"} alt="M8M8S" width="500" height="500" /></span>;
}
