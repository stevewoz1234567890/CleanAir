import React, { useEffect } from "react";
import PrePendLabel from "../utilities/prependLabel";
import { Form, Input, Button, Card } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { verify2FA } from "../../redux/slices/userReducer";
import { useHistory } from "react-router-dom";
import styled from "styled-components";

const TwoFactorWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;

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
`;

const TwoFactorAuthLogin = (props) => {
  const history = useHistory();
  const dispatch = useDispatch();
  const [form] = Form.useForm();
  const user = useSelector((state) => state.user);
  const { settwoFactor } = props;

  useEffect(() => {
    if (user.loggedIn) {
      history.push("/loggedin");
    }
  }, [user]);

  const on2FA = (formData) => {
    dispatch(
      verify2FA({
        token: formData.token,
        userid: user.id,
      })
    );
  };

  return (
    <TwoFactorWrapper>
      <Card
        title="Two Factor Authentication"
        bordered={false}
        className="col-xl-3 col-lg-4 col-md-6 col-sm-8 col-xs-10"
      >
        <center>
          <Form name="2FA" onFinish={on2FA} requiredMark={false} form={form}>
            <div className="input-group">
              <PrePendLabel
                title={<i style={{ width: "20px" }} className="fas fa-key"></i>}
                borderTopLeftRadius={"100px"}
                borderBottomLeftRadius={"100px"}
              />
              <Form.Item
                name="token"
                style={{ flex: 1 }}
                rules={[
                  {
                    required: true,
                    message: "Please input verification code",
                  },
                ]}
              >
                <Input
                  placeholder="Verification Code"
                  style={{ borderRadius: "0px 100px 100px 0px" }}
                  type="text"
                  id="token"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </Form.Item>
            </div>

            <Form.Item>
              <Button type="primary" htmlType="submit" className="verify-btn">
                Verify
              </Button>
            </Form.Item>
            <Button
              type="secondary"
              htmlType="submit"
              style={{ width: "35%", borderRadius: "100px" }}
              onClick={() => settwoFactor(false)}
            >
              Go Back
            </Button>
          </Form>
          <div className="powerd-by">
            <span>
              Powered by <span className="color-primary">Clean Cloud</span>
            </span>
          </div>
        </center>
      </Card>
    </TwoFactorWrapper>
  );
};

export default TwoFactorAuthLogin;
