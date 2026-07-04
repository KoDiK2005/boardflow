import { MentionableUser } from "../api/mentions";

export function MentionText({ text, users }: { text: string; users: MentionableUser[] }) {
  const namesLower = new Set(users.map((u) => u.name.toLowerCase()));
  const parts = text.split(/(@[A-Za-z0-9_]+)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("@")) {
          const name = part.slice(1).replace(/_/g, " ");
          if (namesLower.has(name.toLowerCase())) {
            return (
              <span key={i} className="mention-highlight">
                @{name}
              </span>
            );
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
