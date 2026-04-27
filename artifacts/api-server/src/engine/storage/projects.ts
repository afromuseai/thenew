const store = new Map<string, any>();

export const ProjectStore = {
  save(id: string, data: any) {
    store.set(id, data);
  },

  get(id: string) {
    return store.get(id);
  },

  all() {
    return Array.from(store.values());
  },
};
