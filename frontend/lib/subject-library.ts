export type SubjectLibraryItem = {
  id: string;
  name: string;
  url: string;
};

const STORAGE_KEY = "pipeline-subject-library";
const withoutPrompt = (item: SubjectLibraryItem): SubjectLibraryItem => ({
  id: item.id,
  name: item.name,
  url: item.url,
});

export const subjectLibrary = {
  list(): SubjectLibraryItem[] {
    if (typeof window === "undefined") return [];
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SubjectLibraryItem[];
      const items = stored.map(withoutPrompt);
      if (JSON.stringify(stored) !== JSON.stringify(items)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      }
      return items;
    } catch {
      return [];
    }
  },
  add(item: SubjectLibraryItem) {
    const items = [withoutPrompt(item), ...subjectLibrary.list()];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("subject-library-changed"));
  },
  save(items: SubjectLibraryItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.map(withoutPrompt)));
    window.dispatchEvent(new Event("subject-library-changed"));
  },
};
