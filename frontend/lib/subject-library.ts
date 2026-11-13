export type SubjectLibraryItem = {
  id: string;
  name: string;
  description?: string;
  url: string;
};

const STORAGE_KEY = "pipeline-subject-library";

export const subjectLibrary = {
  list(): SubjectLibraryItem[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SubjectLibraryItem[];
    } catch {
      return [];
    }
  },
  add(item: SubjectLibraryItem) {
    const items = [item, ...subjectLibrary.list()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("subject-library-changed"));
  },
};
