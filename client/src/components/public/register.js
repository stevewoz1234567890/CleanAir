import React from "react";
import { Form, Input, Button, Card, notification } from "antd";
import PrePendLabel from "../utilities/prependLabel";
import PasswordRequirements from "./passwordRequirements";
import styled from "styled-components";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { register } from "../../redux/slices/userReducer";

const SignupWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  background-image: url("/images/bg_cleancloud_icon_logo.jpg");
  width: 100%;
  background-size: cover;

  .color-primary {
    color: #007cc3;
  }

  .ant-card-head {
    border-bottom: 0;
    color: #007cc3;
    font-size: 25px;
  }

  .form-item {
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

  .signup-btn {
    width: 80%;
    border-radius: 10px;
    background-color: #007cc2;
    height: 40px;
  }

  .login-link {
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
    margin-top: 30px;
  }

  .ant-card-body {
    padding-bottom: 0;
  }

  .ant-card {
    border-radius: 10px;
    text-align: center;
    padding: 30px 30px 10px 30px;
  }

  .ant-form-item-explain.ant-form-item-explain-error {
    font-size: 0.8rem;
  }

  @media screen and (max-width: 800px) {
    .ant-card {
      margin: 20px;
    }
  }
`;

const Register = () => {
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const history = useHistory();

  const query = new URLSearchParams(useLocation().search);
  const email = query.get("email");
  const inviteId = query.get("inviteId");

  const onRegister = async (formData) => {
    try {
      const res = await dispatch(register(formData));      
      if (res) {
        notification["success"]({
          message: "Successfully Registered",
          placement: "bottomLeft",
          description: res?.data?.msg || "Sign Up Success",
        });
        history.push("/login");
      }
    } catch(err) {
      notification["error"]({
        message: "ERROR",
        placement: "bottomLeft",
        description: err.response?.data?.msg || "Failed to Register",
      });
    }
  };

  return (
    <SignupWrapper>
      <Card
        title="Register"
        bordered={false}
        className="col-xl-3 col-lg-4 col-md-6 col-sm-8 col-xs-10"
      >
        <center>
          <Form
            name="basic"
            onFinish={onRegister}
            requiredMark={false}
            form={form}
            initialValues={{
              inviteId,
              email,
            }}
          >
            <div
              className="input-group form-item"
              style={{ flexWrap: "nowrap" }}
            >
              <p className="mb-1">Invitation ID</p>
              <Form.Item
                name="inviteId"
                rules={[
                  {
                    required: true,
                    message: "Please input your Invitation ID!",
                  },
                ]}
              >
                <Input
                  placeholder="Invitation ID"
                  type="text"
                  prefix={<i className="far fa-envelope"></i>}
                />
              </Form.Item>
            </div>
            <div
              className="input-group form-item"
              style={{ flexWrap: "nowrap" }}
            >
              <p className="mb-1">First Name</p>
              <Form.Item
                name="firstName"
                rules={[
                  {
                    required: true,
                    message: "Please input your First Name!",
                  },
                ]}
              >
                <Input
                  placeholder="First Name"
                  type="text"
                  prefix={<i className="far fa-envelope"></i>}
                />
              </Form.Item>
            </div>
            <div
              className="input-group form-item"
              style={{ flexWrap: "nowrap" }}
            >
              <p className="mb-1">Last Name</p>
              <Form.Item
                name="lastName"
                rules={[
                  {
                    required: true,
                    message: "Please input your Last Name!",
                  },
                ]}
              >
                <Input
                  placeholder="Last Name"
                  type="text"
                  prefix={<i className="far fa-envelope"></i>}
                />
              </Form.Item>
            </div>
            <div
              className="input-group form-item"
              style={{ flexWrap: "nowrap" }}
            >
              <p className="mb-1">Email</p>
              <Form.Item
                name="email"
                rules={[
                  {
                    required: true,
                    message: "Please input your email!",
                  },
                  {
                    type: "email",
                    message: "The input is not valid E-mail!",
                  },
                ]}
              >
                <Input
                  placeholder="Email"
                  type="email"
                  autoComplete="email"
                  prefix={<i className="far fa-envelope"></i>}
                />
              </Form.Item>
            </div>
            <div
              className="input-group form-item"
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
                          "Password should have at least 1 Uppercase, 1 lowercase, 1 number, 1 Special Character and 11 characters minimum"
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

            <div className="input-group form-item">
              <p className="mb-1">Confirm Password</p>
              <Form.Item
                name="confirmPassword"
                dependencies={["password"]}
                style={{ flexGrow: 1 }}
                rules={[
                  {
                    required: true,
                    message: "Please confirm your password!",
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
                  placeholder="Re-enter your Password"
                  type="password"
                  autoComplete="new-password"
                  prefix={<i className="fas fa-lock"></i>}
                />
              </Form.Item>
            </div>
            <br></br>
            <Form.Item>
              <Button type="primary" htmlType="submit" className="signup-btn">
                Register
              </Button>
            </Form.Item>
          </Form>

          <div className="w-100 flex flex-direction-column mt-2 login-link ">
            <p className="mb-0">Already have an account</p>
            <span onClick={() => history.push("/login")}>Login</span>
          </div>

          <div className="powerd-by">
            <span>
              Powered by <span className="color-primary">Clean Cloud</span>
            </span>
          </div>
        </center>
      </Card>
    </SignupWrapper>
  );
};

export default Register;
