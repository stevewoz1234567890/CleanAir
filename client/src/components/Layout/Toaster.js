import React, { Fragment,useState } from 'react';
import { notification, Space } from 'antd';


export const showMessage = (title,message) => {
    notification.open({
      message: title,
      description:message,
      placement : 'topLeft',
      duration : 3
    });
  };
