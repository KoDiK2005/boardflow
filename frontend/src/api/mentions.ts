import { BoardDetail } from "./types";

export interface MentionableUser {
  id: string;
  name: string;
}

export function getMentionableUsers(board: BoardDetail): MentionableUser[] {
  const map = new Map<string, MentionableUser>();
  map.set(board.owner.id, board.owner);
  for (const member of board.members) {
    map.set(member.user.id, { id: member.user.id, name: member.user.name });
  }
  return [...map.values()];
}

export function encodeMentionToken(name: string) {
  return name.trim().replace(/\s+/g, "_");
}
