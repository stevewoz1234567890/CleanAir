import React from "react";
import { useSelector } from "react-redux";
import styled from 'styled-components';

const InputWrapper = styled.div`
  margin: 0;
  padding: 6.5px 11px;
  font-size: 16px;
  font-variant: tabular-nums;
  list-style: none;
  -webkit-font-feature-settings: 'tnum';
  font-feature-settings: 'tnum', "tnum";
  position: relative;
  display: inline-block;
  width: 100%;
  min-width: 0;
  color: rgba(0, 0, 0, 0.7);
  line-height: 1.5715;
  background-image: none;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
  -webkit-transition: all 0.3s;
  transition: all 0.3s;
  background-color: #f5f5f5;
  cursor: not-allowed;
  opacity: 1;
`;

const MyAccount = () => {
  const user = useSelector((state) => state.user);

  return (
    <div className="d-flex flex-column row align-items-center justify-content-center w-50">
      <div className="card w-100">
        <div className="card-header">Account Details</div>
        <div className="card-body" style={{ padding: "5px" }}>
          <div className="container">
            <p className="mb-2">Name: </p>
            <InputWrapper>{user?.name}</InputWrapper>
          </div>
          <div className="container mt-4">
            <p className="mb-2">Email: </p>
            <InputWrapper>{user?.email}</InputWrapper>
          </div>
          <div className="container mt-4 pb-4">
            <p className="mb-2">Organization Name: </p>
            <InputWrapper>{user?.selectedOrg?.name}</InputWrapper>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyAccount;
