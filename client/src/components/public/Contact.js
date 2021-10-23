import React, { useEffect } from "react";
import { Result } from "antd";
import styled from "styled-components";

const ContactForm = styled.div`
  width: 60% !important;
  margin: 0 auto !important;

  form {
    text-align: left !important;
  }
  .field {
    margin-bottom: 10px;
  }
  .hs-fieldtype-textarea {
    margin-bottom: 0 !important;
  }
  .hs-form {
    text-align: center;
  }
  fieldset .hs-error-msgs {
    display: none !important;
  }
  .field label {
    color: #007cc3;
  }
  .hs-error-msgs {
    margin: 0;
    list-style: none;
    padding: 0;
  }
  .hs-error-msgs label {
    color: red;
    font-size: 10px;
  }
  .actions {
    margin-top: 20px;
  }
  input:not(.primary) {
    border: 1px solid #ccc !important;
    color: black;
    height: 40px;
    border-radius: 5px;
    width: 100% !important;
    letter-spacing: 1px;
    padding: 3px 20px;

    &:focus {
      outline: none;
    }
  }
  textarea {
    width: 100% !important;
    border: 1px solid #ccc !important;
    color: black;
    border-radius: 5px;
    padding: 3px 20px;
    &:focus {
      outline: none;
    }
  }
  .hs_submit.hs-submit input[type="submit"] {
    background-color: #007cc3 !important;
    color: #fff !important;
    height: 40px;
    margin-top: 20px;
    border: none !important;
    line-height: 40px;
    border-radius: 5px;
    margin-bottom: 10px;
    padding: 0 41px;
  }

  @media screen and (max-width: 1000px) {
    width: 80% !important;
  }
`;

const Contact = () => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://js.hsforms.net/forms/v2.js";
    document.body.appendChild(script);

    script.addEventListener("load", () => {
      if (window.hbspt) {
        window.hbspt.forms.create({
          portalId: "3331037",
          formId: "b3a5ca38-30ac-4868-9b7d-d3e5aad51ee4",
          target: "#hubspotForm",
        });
      }
    });
  }, []);

  return (
    <div className="d-flex flex-column row align-items-center justify-content-center w-100">
      <ContactForm id="hubspotForm"></ContactForm>
    </div>
  );
};

export default Contact;
