import React, { useState, useEffect } from "react";
import { Form, Input, Button, Card } from "antd";
import { login } from "../../redux/slices/userReducer";
import { useDispatch, useSelector } from "react-redux";
import TwoFactorAuthLogin from "./twoFactorAuthLogin";
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

  .expire-password {
    position: absolute;
    bottom: 4px;
    left: 0;
    color: #ff4d4f;
    font-size: 12px;
    transition: color 0.3s cubic-bezier(0.215, 0.61, 0.355, 1);
  }

  .forgot-password {
    color: #007cc3;
    font-size: 10px;
    position: absolute;
    bottom: 5px;
    right: 0;
    cursor: pointer;
  }

  .login-btn {
    width: 80%;
    margin-top: 50px;
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

  @media screen and (max-width: 800px) {
    padding: 20px 30px 10px 30px;
    .powerd-by {
      margin-top: 20px;
    }
  }
`;

const LoginWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: url("/images/bg_cleancloud_icon_logo.jpg");
  width: 100%;
  background-size: cover;
`;

const Login = () => {
  const dispatch = useDispatch();
  const history = useHistory();
  const [form] = Form.useForm();
  const [twoFactor, settwoFactor] = useState(false);
  const user = useSelector((state) => state.user);

  const isPasswordExpired = user.error && user.error === "Password Expired";

  useEffect(() => {
    if (user && user.require2FA) {
      settwoFactor(true);
    }
  }, [user]);

  useEffect(() => {
    if (user.loggedIn) {
      history.push("/home");
    }
  }, [user, history]);

  //cleanup function to reset 2fa when component is disposed
  useEffect(() => {
    return settwoFactor(false);
  }, []);

  const onLogin = (formData) => {
    dispatch(login(formData));
  };

  return (
    <LoginWrapper className="col-lg-12">
      {!twoFactor && (
        <CardWrapper
          title="Login"
          bordered={false}
          className="col-xl-3 col-lg-4 col-md-6 col-sm-8 col-xs-10"
        >
          <center>
            <Form
              name="login"
              onFinish={onLogin}
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

              <div className="input-group password">
                <p className="mb-1">Password</p>
                <Form.Item
                  name="password"
                  rules={[
                    {
                      required: true,
                      message: "Please input a password",
                    },
                  ]}
                >
                  <Input.Password
                    visibilityToggle={false}
                    placeholder="Password"
                    type="password"
                    autoComplete="current-password"
                    prefix={<i className="fas fa-lock"></i>}
                  />
                </Form.Item>
                {isPasswordExpired && (
                  <span className="expire-password">
                    Your Password is Expired!
                  </span>
                )}

                <div className="forgot-password">
                  <span onClick={() => history.push("/forgot-password")}>
                    {isPasswordExpired ? "Reset Password" : "Forgot Password?"}
                  </span>
                </div>
              </div>

              <Form.Item>
                <Button type="primary" htmlType="submit" className="login-btn">
                  Login
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
      )}
      {twoFactor && <TwoFactorAuthLogin settwoFactor={settwoFactor} />}
    </LoginWrapper>
  );
};

export default Login;
