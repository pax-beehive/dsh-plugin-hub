import Image from "next/image";

export default function BrandLogo() {
  return (
    <span className="brand-logo" aria-hidden="true">
      <Image
        src="/deepseek-whale-black.svg"
        alt=""
        width={24}
        height={24}
        priority
      />
    </span>
  );
}
