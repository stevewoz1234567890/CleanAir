import SortByName from './sortByName';

// this.bson = stitch.BSON.ObjectId;

export default function buildChartDataOptions(allData) {
  console.log('test', allData);
  const data = [];

  for (const flare of allData.flares) {
    const flare_headers = allData.headers.filter(
      (row) => row.parent_id === flare._id
    );
    for (const formula of allData.formulas) {
      if (formula.to === 'headers') {
        for (const header of flare_headers) {
          data.push({
            _id: new this.bson().toString(),
            text: `${formula.name}`,
            sub_text: `${header.name}`,
            flare_id: flare._id,
            type: 'formula',
            parent_id: header._id,
            param_id: formula._id,
          });
        }
      } else {
        data.push({
          _id: new this.bson().toString(),
          text: `${formula.name}`,
          sub_text: `${flare.name}`,
          flare_id: flare._id,
          type: 'formula',
          parent_id: flare._id,
          param_id: formula._id,
        });
      }
    }
    const flare_sensors = allData.sensors.filter(
      (row) => row.parent_id === flare._id
    );
    for (const sensor of flare_sensors) {
      const sensor_tags = allData.pi_tags.filter(
        (row) => row.parent_id === sensor._id
      );
      for (const tag of sensor_tags) {
        const tag_param = allData.parameters.filter(
          (row) => row._id === tag.param_id
        )[0];
        data.push({
          _id: new this.bson().toString(),
          text: `${tag_param.parameter}`,
          sub_text: `${sensor.name} (${tag.pi_tag})`,
          flare_id: flare._id,
          type: 'pi_tag',
          parent_id: null,
          param_id: tag._id,
        });
      }
    }
    for (const header of flare_headers) {
      const header_sensors = allData.sensors.filter(
        (row) => row.parent_id === header._id
      );
      for (const sensor of header_sensors) {
        const sensor_tags = allData.pi_tags.filter(
          (row) => row.parent_id === sensor._id
        );
        for (const tag of sensor_tags) {
          const tag_param = allData.parameters.filter(
            (row) => row._id === tag.param_id
          )[0];
          data.push({
            _id: new this.bson().toString(),
            text: `${tag_param.parameter}`,
            sub_text: `${sensor.name} (${tag.pi_tag})`,
            flare_id: flare._id,
            type: 'pi_tag',
            parent_id: null,
            param_id: tag._id,
          });
        }
      }
    }
  }
  return SortByName(data, 'text');
}
