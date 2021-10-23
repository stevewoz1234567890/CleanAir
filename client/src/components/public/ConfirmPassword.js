import React from "react";
import { Form, Input, Button, Card } from "antd";
import styled from "styled-components";
import { useDispatch, useSelector } from "react-redux";
import { reset, resetPassword } from "../../redux/slices/userReducer";
import { useHistory } from "react-router-dom";

const ConfirmPasswordWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  background-image: url("/images/bg_cleancloud_icon_logo.jpg");
  background-size: cover;

  .verify-btn {
    width: 80%;
    margin-top: 20px;
    border-radius: 10px;
    background-color: #007cc2;
    height: 40px;
  }

  .ant-card {
    border-radius: 10px;
    text-align: center;
    padding: 50px 30px 10px 30px;
  }

  .ant-card-head {
    border-bottom: 0;
    color: #007cc3;
    font-size: 20px;
  }

  .powerd-by {
    font-size: 10px;
    margin-top: 40px;
  }

  .color-primary {
    color: #007cc3;
  }

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
`;

const ConfirmPassword = (props) => {
  const history = useHistory();
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const user = useSelector((state) => state.user);

  const onVerify = (formData) => {
    dispatch(
      resetPassword({
        token: user.resetToken,
        userId: user.id,
        password: formData.password
      })
    ).then((res) => {
      if (res) {
        history.push('/login')
      }
    })
  };
  
  const goBack = () => {
    dispatch(reset())
    history.push('/login')
  }

  return (
    <ConfirmPasswordWrapper>
      <Card
        title="New Password"
        bordered={false}
        className="col-xl-3 col-lg-4 col-md-6 col-sm-8 col-xs-10"
      >
        <center>
          <Form name="2FA" onFinish={onVerify} requiredMark={false} form={form}>
            <div
              className="input-group form-item password"
              style={{ flexWrap: "nowrap" }}
            >
              <p className="mb-1">Password</p>
              <Form.Item
                name="password"
                style={{ flexGrow: 1 }}
                rules={[
                  {
                    required: true,
                    message: "Please input your password!",
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (
                        !value ||
                        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[`~\!@#\$%\^\&\*\(\)\-_\=\+\[\{\}\]\|;:\'",<.>\/\\\?€£¥₹§±])[a-zA-Z\d`~\!@#\$%\^\&\*\(\)\-_\=\+\[\{\}\]\|;:\'",<.>\/\\\?€£¥₹§±]{11,}$/.test(
                          value
                        )
                      ) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error(
                          "Password should have at least 1 Uppercase, 1 Lowercase, 1 Number, 1 Special Character and 11 characters minimum"
                        )
                      );
                    },
                  }),
                ]}
              >
                <Input.Password
                  visibilityToggle={false}
                  placeholder="Create a Password"
                  type="password"
                  autoComplete="new-password"
                  prefix={<i className="fas fa-lock"></i>}
                />
              </Form.Item>
            </div>
            <div className="input-group password">
              <p className="mb-1">Confirm Password</p>
              <Form.Item
                name="confirmPassword"
                rules={[
                  {
                    required: true,
                    message: "Re-enter your Password",
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error(
                          "The two passwords that you entered do not match!"
                        )
                      );
                    },
                  }),
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
            </div>

            <Form.Item>
              <Button type="primary" htmlType="submit" className="verify-btn">
                Confirm Password
              </Button>
            </Form.Item>
            <Button
              type="secondary"
              htmlType="button"
              style={{ width: "35%", borderRadius: "100px" }}
              onClick={goBack}
            >
              Login
            </Button>
          </Form>
          <div className="powerd-by">
            <span>
              Powered by <span className="color-primary">Clean Cloud</span>
            </span>
          </div>
        </center>
      </Card>
    </ConfirmPasswordWrapper>
  );
};

export default ConfirmPassword;
