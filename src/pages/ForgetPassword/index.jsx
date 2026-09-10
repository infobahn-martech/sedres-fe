import React from "react";
import { useForm } from "react-hook-form";
import "../../design/scss/login.scss";
import { Link, useNavigate } from "react-router-dom";
import useAuthReducer from "../../store/AuthReducer";

function ForgetPassword() {
  const navigate = useNavigate();
  const { forgotPassword, isLoginLoading } = useAuthReducer();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    await forgotPassword({ email: data.email });
  };

  return (
    <div className="login-wrap">
      {/* LEFT SIDE */}
      <div className="left-wrap">
        <div className="logo-wrap">
          <img src="img/logo-white.svg" alt="" />
        </div>

        <div className="content-wrap">
          <h1 className="title">
            Reset Your Access,
            <span>Restore Productivity.</span>
          </h1>
          <p className="des">
            Secure and seamless recovery to help you get back to efficient
            port operations.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="form-wrap">
        <div className="content-wrap">
          <div className="logo-wrap">
            <img src="img/logo-blue.svg" alt="" />
          </div>

          <div className="head-wrap">
            <h2 className="title">Forgot Password?</h2>
            <p className="des">
              Enter your registered email address to reset your password.
            </p>
          </div>

          <div className="form-content-wrap">
            {/* FORM START */}
            <form onSubmit={handleSubmit(onSubmit)}>
              {/* EMAIL */}
              <div className="input-outer-wrap">
                <label className="label">Email</label>
                <div className="input-wrap">
                  <input
                    type="text"
                    placeholder="Enter your email"
                    className="txt"
                    {...register("email", {
                      required: "Email is required",
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i,
                        message: "Enter a valid email",
                      },
                    })}
                  />

                  {errors.email && (
                    <div className="error">{errors.email.message}</div>
                  )}
                </div>
              </div>

              {/* BUTTON */}
              <div className="btn-wrap">
                <button className="btn-red" type="submit" disabled={isLoginLoading}>
                  {isLoginLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </form>
          </div>

          {/* BACK TO LOGIN */}
          <div className="forgot-wrap">
            <Link onClick={() => navigate("/")} className="link">
              ← Back to Login
            </Link>
          </div>

          <p className="copy">© Sedres 2026</p>
        </div>
      </div>
    </div>
  );
}

export default ForgetPassword;
