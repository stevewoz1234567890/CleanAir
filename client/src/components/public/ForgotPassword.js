import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card } from "antd";
import { useSelector, useDispatch } from "react-redux";
import { confirmEmail } from "../../redux/slices/userReducer";
import { useHistory } from "react-router-dom";
import styled from "styled-components";

const CardWrapper = styled(Card)`
  border-radius: 10px;
  text-align: center;
  padding: 50px 30px 10px 30px;

  .color-primary {
    color: #007cc3;
  }

  .ant-card-head {
    border-bottom: 0;
    color: #007cc3;
    font-size: 25px;
  }

  .username,
  .password {
    display: flex;
    flex-direction: column;
    text-align: left;
    position: relative;

    p {
      color: #626262;
    }
  }

  .ant-input-affix-wrapper {
    border: 0;
    padding-left: 5px;
    border-bottom: 1px solid #dedede;
  }

  .ant-input-affix-wrapper-focused {
    box-shadow: none;
  }

  input {
    border-radius: 0;
    width: 100%;
    padding-left: 4px !important;
  }

  .forgot-password {
    color: #007cc3;
    font-size: 10px;
    position: absolute;
    bottom: 5px;
    right: 0;
    cursor: pointer;
  }

  .forgot-password-btn {
    width: 80%;
    margin-top: 30px;
    border-radius: 10px;
    background-color: #007cc2;
    height: 40px;
  }

  .register-link {
    p {
      color: #c3c3c3;
    }

    span {
      color: #007cc3;
      font-weight: 500;
      cursor: pointer;
    }
  }

  .powerd-by {
    font-size: 10px;
    margin-top: 70px;
  }

  .ant-card-body {
    padding-bottom: 0;
  }
`;

const ForgotPasswordWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: url("/images/bg_cleancloud_icon_logo.jpg");
  width: 100%;
  background-size: cover;
`;

const ForgotPassword = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const [form] = Form.useForm();
  const user = useSelector((state) => state.user);

  useEffect(() => {
    console.log(user)
    if (user && user.require2FA) {
      history.push(`/verify-code`);
    }
  }, [user]);

  useEffect(() => {
    if (user.loggedIn) {
      history.push("/home");
    }
  }, [user, history]);

  const onSendCode = (formData) => {
    dispatch(confirmEmail(formData));
  };

  return (
    <ForgotPasswordWrapper className="col-lg-12">
      <CardWrapper
        title="Forgot Password"
        bordered={false}
        className="col-xl-3 col-lg-4 col-md-6 col-sm-8 col-xs-10"
      >
        <center>
          <Form
            name="forgotPassword"
            onFinish={onSendCode}
            requiredMark={false}
            form={form}
          >
            <div className="input-group username">
              <p className="mb-1">Email</p>
              <Form.Item
                name="email"
                rules={[
                  {
                    required: true,
                    message: "Please input an email",
                  },
                ]}
              >
                <Input
                  prefix={<i className="far fa-envelope"></i>}
                  type="email"
                  autoComplete="email"
                  placeholder="Enter your email address"
                />
              </Form.Item>
            </div>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="forgot-password-btn"
              >
                Send 2FA Code
              </Button>
            </Form.Item>
          </Form>

          <div className="w-100 flex flex-direction-column mt-2 register-link ">
            <p className="mb-0">Don't have an account</p>
            <span onClick={() => history.push("/signup")}>Register</span>
          </div>

          <div className="powerd-by">
            <span>
              Powered by <span className="color-primary">Clean Cloud</span>
            </span>
          </div>
        </center>
      </CardWrapper>
    </ForgotPasswordWrapper>
  );
};

export default ForgotPassword;
