import { commentSubjects } from "@/lib/products";

export interface Comment {
  id: number;
  authorName: string;
  subject: string;
  content: string;
  visibility: "public" | "private";
  createdAt: string;
  replies?: Comment[];
}

interface CommentListProps {
  comments: Comment[];
  emptyMessage?: string;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function subjectLabel(value: string) {
  return commentSubjects.find((s) => s.value === value)?.label ?? value;
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <article className="comment">
      <div className="comment-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="comment-author">{comment.authorName}</span>
          <span className="comment-subject">{subjectLabel(comment.subject)}</span>
          {comment.visibility === "private" && (
            <span className="badge private">Privé</span>
          )}
        </div>
        <div className="comment-meta">
          <span>{formatDate(comment.createdAt)}</span>
        </div>
      </div>
      <div className="comment-body">{comment.content}</div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map((r) => (
            <CommentItem key={r.id} comment={r} />
          ))}
        </div>
      )}
    </article>
  );
}

export function CommentList({
  comments,
  emptyMessage = "Aucun commentaire public pour le moment. Soyez le premier à partager une recommandation.",
}: CommentListProps) {
  if (!comments.length) {
    return (
      <div className="notice">
        <p style={{ margin: 0 }}>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div>
      {comments.map((c) => (
        <CommentItem key={c.id} comment={c} />
      ))}
    </div>
  );
}
