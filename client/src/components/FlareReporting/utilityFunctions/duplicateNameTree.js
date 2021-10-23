import { notification } from 'antd';

const validateDuplicateName = (sourceArray, name, edit_id, parent_id) => {
  //duplicate name checking for tree elements on hold
  //check if name already exists (ignores case) when adding or editing item
  //check only on the same parent
  if (edit_id === parent_id) {
    //POST
    for (let element of sourceArray) {
      if (
        name.toLowerCase() === element.name.toLowerCase() &&
        element.parent_id === parent_id
      ) {
        notification['error']({
          message: 'Error',
          placement: 'bottomLeft',
          description: 'Name already exists',
        });
        return false;
      }
    }
  } else {
    //PUT
    for (let element of sourceArray) {
      if (
        edit_id !== element._id &&
        element.parent_id === parent_id &&
        name.toLowerCase() === element.name.toLowerCase()
      ) {
        console.log('Editing ID', edit_id, name.toLowerCase());
        console.log('Conflicting ID', element._id, element.name.toLowerCase());
        notification['error']({
          message: 'Error',
          placement: 'bottomLeft',
          description: 'Name already exists',
        });
        return false;
      }
    }
  }

  return true;
};

export default validateDuplicateName;
