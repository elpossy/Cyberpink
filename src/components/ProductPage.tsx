import Link from "next/link";
import { type Product } from "@/lib/products";
import { DonateButton } from "@/components/DonateButton";
import { CommentForm } from "@/components/CommentForm";
import { CommentList, type Comment } from "@/components/CommentList";
import type { CommentSubject } from "@/lib/products";

interface ProductPageProps {
  product: Product;
  comments?: Comment[];
}

export function ProductPage({ product, comments = [] }: ProductPageProps) {
  const subject = product.slug as CommentSubject;

  return (
    <>
      <section className="hero" style={{ padding: "64px 0 48px" }}>
        <div className="wrap">
          <span className="eyebrow">{product.code}</span>
          <h1 style={{ fontSize: "clamp(30px, 4.4vw, 44px)", marginTop: 12 }}>
            {product.name}
          </h1>
          <p className="lead">{product.shortDesc}</p>
          <div className="hero-cta">
            {product.status === "available" && product.tryUrl && (
              <a href={product.tryUrl} className="btn btn-primary">
                {product.tryLabel}
              </a>
            )}
            <DonateButton productName={product.name} variant="ghost-dark" />
            <Link href="/produits" className="btn btn-ghost-dark">
              ← Tous les produits
            </Link>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap grid-2">
          <div>
            <span className="eyebrow">À propos</span>
            <h2 style={{ marginTop: 14, fontSize: 26 }}>{product.name}</h2>
            <p style={{ color: "var(--slate)", marginTop: 16, lineHeight: 1.7 }}>
              {product.longDesc}
            </p>
            <div style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
              {product.status === "available" && product.tryUrl && (
                <a href={product.tryUrl} className="btn btn-primary">
                  {product.tryLabel}
                </a>
              )}
              <DonateButton productName={product.name} variant="outline-pink" />
            </div>
          </div>
          <div>
            <div className="card">
              <span className="reg-code">Statut</span>
              <h3 style={{ fontSize: 18, marginTop: 10 }}>{product.statusLabel}</h3>
              <p style={{ marginBottom: 0 }}>
                {product.status === "available"
                  ? "Ce produit est accessible. Cliquez sur le bouton pour l'essayer."
                  : "Ce produit est en cours de développement. Revenez bientôt."}
              </p>
            </div>
            <div className="card" style={{ marginTop: 16 }}>
              <span className="reg-code">Maison mère</span>
              <h3 style={{ fontSize: 18, marginTop: 10 }}>cyberPink</h3>
              <p style={{ marginBottom: 0 }}>
                Filiale de la holding cyberPink, basée à Niamey, Niger. Produit conçu par et pour
                l&apos;Afrique.
              </p>
            </div>
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* COMMENTAIRES DU PRODUIT */}
      <section>
        <div className="wrap">
          <div className="section-head">
            <span className="eyebrow">Commentaires — {product.name}</span>
            <h2 style={{ marginTop: 14 }}>Retours de la communauté</h2>
            <p>
              Les commentaires ci-dessous concernent {product.name}. Le sujet est pré-sélectionné.
              Vous pouvez choisir une visibilité publique ou privée.
            </p>
          </div>

          <CommentList
            comments={comments}
            emptyMessage={`Aucun commentaire public sur ${product.name} pour le moment. Soyez le premier.`}
          />

          <div style={{ marginTop: 36 }}>
            <h3 style={{ fontSize: 18, marginBottom: 12 }}>
              Commenter {product.name}
            </h3>
            <CommentForm
              defaultSubject={subject}
              lockedSubject
              isAuthenticated={false}
            />
          </div>

          <div style={{ marginTop: 40 }}>
            <DonateButton productName={product.name} />
          </div>
        </div>
      </section>
    </>
  );
}
