import { notification } from 'antd';
import axios from 'axios';

const crudSave = async (
  addModeAndRevertFNobj,
  collectionAndSchema,
) => {
  const addMode = addModeAndRevertFNobj.addMode;
  const collection = collectionAndSchema.collection;
  const schema = collectionAndSchema.schema;

  try {
    let result = null;
    addMode
      ? (result = await axios.post(`/api/widgets/flarereporting/${collection}`, schema))
      : (result = await axios.put(
          `/api/widgets/flarereporting/${collection}/${schema._id}`,
          schema
        ));
    notification['success']({
      message: 'Success',
      placement: 'bottomLeft',
      description: `Successfully ${addMode ? 'Saved' : 'Updated'}`,
    });
    return result;
  } catch (err) {
    notification['error']({
      message: 'Error',
      placement: 'bottomLeft',
      description: `Error saving item`,
    });
  }
};

export const crudDelete = async (
  collection, id
) => {
  try {
    let result = null;
    result = await axios.delete(`/api/widgets/flarereporting/${collection}/${id}`);
    notification['success']({
      message: 'Success',
      placement: 'bottomLeft',
      description: `Successfully Deleted`,
    });

  } catch (err) {
    console.log(err);
    notification['error']({
      message: 'Error',
      placement: 'bottomLeft',
      description: `Error removing item`,
    });
  }
};

export default crudSave;
