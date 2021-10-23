const SortByName = (arrayOfObjects, field = 'name') => {
  if (arrayOfObjects && arrayOfObjects.length >= 1) {
    function sortByName(a, b) {
      try {
        const constantA = a[field].toUpperCase();
        const constantB = b[field].toUpperCase();
        let comparison = 0;
        if (constantA > constantB) {
          comparison = 1;
        } else if (constantA < constantB) {
          comparison = -1;
        }
        return comparison;
      } catch (e) {
        throw e;
      }
    }
    return arrayOfObjects.slice().sort(sortByName);
  }
  return null;
};

export default SortByName;
