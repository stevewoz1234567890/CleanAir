import React from "react";
import { useHistory } from "react-router-dom";
import styled from "styled-components";

const defaultTextColor = "#007cc3";
const LoginButton = styled.button`
  background-color: #08c;
  padding: 15px 80px;
  font-weight: 400;
  box-shadow: 0 2px 0 #006394;
  letter-spacing: 2px;
  color: #fff;
  font-size: 1.2vw;
  border-radius: 5px;
  border: 1px solid transparent;
  width: 300px;
  box-shadow: 0px 5px 2px #007cc360;
  margin-bottom: 10px;

  @media screen and (max-width: 1400px) {
    width: 200px;
  }

  @media screen and (max-width: 600px) {
    font-size: 15px;
    padding: 5px 10px;
    margin-top: 10px;
    width: 100px;
  }
`;

const TitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 130px;
  width: 100%;
  align-items: center;
  color: lightgray;

  h1 {
    color: ${defaultTextColor};
    font-size: 80px;
    text-shadow: 2px 6px 1px #007cc340;
    padding-bottom: 10px;
  }

  span {
    color: #08c;
    font-size: 14px;
    cursor: pointer;
    font-weight: 500;
    margin-top: 10px;
  }

  @media screen and (max-width: 1400px) {
    h1 {
      font-size: 50px;
    }
  }

  @media screen and (max-width: 1000px) {
    align-items: center;
    text-align: center;
  }

  @media screen and (max-width: 600px) {
    h1 {
      font-size: 30px;
      padding: 0;
    }
  }

  @media screen and (max-width: 400px) {
    top: 100px
  }
`;

const MainVideoWrapper = styled.video`
  width: 100%;
  background-color: #ffffff;
  border-bottom: 2px solid black;

  @media screen and (max-width: 1000px) {
    padding-top: 100px;
  }

  @media screen and (max-width: 600px) {
    padding-top: 150px;
  }
`;

const BottomVideoWrapper = styled.video`
  border: 2px solid gray;
  padding: 0;
  width: 100%;
  margin-top: 15px;
`;

const StatementTitle = styled.span`
  color: ${defaultTextColor};
  font-size: 40px;
  border-bottom: 3px solid ${defaultTextColor};

  @media screen and (max-width: 600px) {
    font-size: 25px;
  }
`;

const BottomWrapper = styled.div`
  display: flex;
  border-top: 1px solid black;
  padding: 40px 50px 50px 100px;
  text-align: left;
  margin: 0;

  @media screen and (max-width: 500px) {
    padding: 30px;

    p {
      padding-right: 0 !important;
    }
  };
`;

const PublicHome = () => {
  const history = useHistory();
  return (
    <div className="text-center w-100 position-relative bg-white">
      <MainVideoWrapper
        src="/assets/videos/Plant-Animation.mp4"
        autoPlay
        loop
        muted
      />
      <TitleWrapper>
        <h1>CleanCloud</h1>
        <LoginButton onClick={() => history.push("/login")}>LOGIN</LoginButton>
        <div>
          or <span onClick={() => history.push("/signup")}>Register</span>
        </div>
      </TitleWrapper>
      <BottomWrapper className="row">
        <div className="col-md-6 col-sm-12">
          <StatementTitle className="pb-2" style={{}}>
            The CleanAir Way
          </StatementTitle>
          <p className="mt-4 pb-4 pr-5">
            Since 1972, CleanAir has had a passion for providing accurate and
            unbiased data to those who need it. That data is then used by
            clients to protect their communities from harmful pollutants. It
            also allows them to show compliance with regulatory standards, as
            well as improve the performance of their facilities. We find it’s
            important to take the time to identify and understand the needs of
            our customers. Thus, we provide cutting-edge measurement solutions.
            These solutions promote environmental sustainability and the
            efficient use of Earth’s natural resources.
          </p>
        </div>
        <div className="col-md-6 col-sm-12 p-0">
          <BottomVideoWrapper
            poster="/images/cleancloud_video_thumbnail_image.png"
            preload="metadata"
            controls
          >
            <source src="https://flare-reporting.s3.amazonaws.com/video-assets/cleancloud_animated_video.mp4" type="video/mp4"></source>
          </BottomVideoWrapper>
        </div>
      </BottomWrapper>
    </div>
  );
};

export default PublicHome;
