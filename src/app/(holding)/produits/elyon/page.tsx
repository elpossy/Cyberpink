import { getProduct } from "@/lib/products";
import { ProductPage } from "@/components/ProductPage";
import { notFound } from "next/navigation";
import type { Comment } from "@/components/CommentList";

const sampleComments: Comment[] = [];

export default function ElyonPage() {
  const product = getProduct("elyon");
  if (!product) notFound();
  return <ProductPage product={product} comments={sampleComments} />;
}
