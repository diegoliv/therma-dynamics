export function createMaterialCollections() {
  return {
    thermal: [],
    cooling: [],
    glass: [],
    floor: [],
    opacity: [],
  };
}

export function registerMaterial(collections, material, collectionNames) {
  collectionNames.forEach((collectionName) => {
    collections[collectionName]?.push(material);
  });
}
