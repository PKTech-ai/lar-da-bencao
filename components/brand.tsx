export function Brand({ prominent = false, subtitle = "Luz, amor e caridade cristã" }: { prominent?: boolean; subtitle?: string }) {
  return (
    <div className={prominent ? "brand-lockup brand-lockup-prominent" : "brand-lockup"}>
      <img
        className="brand-logo"
        src="/marca-lar-da-bencao.png"
        alt="Centro Espírita Filantrópico Lar da Bênção"
        width={801}
        height={840}
      />
      <div>
        <strong>Lar da Bênção</strong>
        <small>{subtitle}</small>
      </div>
    </div>
  );
}
