import Link from "next/link";
import { products } from "@/lib/products";
import { DonateButton } from "@/components/DonateButton";

export default function ProduitsPage() {
  return (
    <>
      <section className="hero" style={{ padding: "64px 0 48px" }}>
        <div className="wrap">
          <span className="eyebrow">Le registre des filiales</span>
          <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)" }}>
            Trois produits, une seule maison mère.
          </h1>
          <p className="lead">
            Antigramme, Elyon et Damundjé sont nées à Niamey, sous un même toit : cyberPink.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap grid-3">
          {products.map((p) => (
            <div className="card" key={p.slug} id={p.slug}>
              <span className="reg-code">{p.code} · Filiale</span>
              <span
                className={`status ${p.status === "available" ? "available" : "soon"}`}
              >
                {p.statusLabel}
              </span>
              <h3>{p.name}</h3>
              <p>{p.longDesc}</p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                <Link href={`/produits/${p.slug}`} className="btn btn-primary" style={{ fontSize: 13, padding: "10px 16px" }}>
                  Voir la page
                </Link>
                {p.status === "available" && p.tryUrl && (
                  <a
                    href={p.tryUrl}
                    className="btn btn-outline-pink"
                    style={{ fontSize: 13, padding: "10px 16px" }}
                  >
                    {p.tryLabel}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="wrap" style={{ marginTop: 48, textAlign: "center" }}>
          <DonateButton />
        </div>
      </section>
    </>
  );
}
