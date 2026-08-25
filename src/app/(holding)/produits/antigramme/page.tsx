import { getProduct } from "@/lib/products";
import { ProductPage } from "@/components/ProductPage";
import { notFound } from "next/navigation";
import type { Comment } from "@/components/CommentList";

const sampleComments: Comment[] = [
  {
    id: 10,
    authorName: "Fatou D.",
    subject: "antigramme",
    content:
      "J'attends avec impatience un réseau social qui ne nous force pas à tout exporter vers l'extérieur. Antigramme a le potentiel de devenir notre place publique numérique.",
    visibility: "public",
    createdAt: "2026-08-11T11:00:00Z",
  },
];

export default function AntigrammePage() {
  const product = getProduct("antigramme");
  if (!product) notFound();
  return <ProductPage product={product} comments={sampleComments} />;
}
