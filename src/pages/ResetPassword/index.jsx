import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { FiEye, FiEyeOff } from "react-icons/fi";
import "../../design/scss/login.scss";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import useAuthReducer from "../../store/AuthReducer";

function ResetPassword() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { resetPassword, isLoginLoading } = useAuthReducer();
    const [token, setToken] = useState(null);
    const [userId, setUserId] = useState(null);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const {
        register,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm();

    useEffect(() => {
        const tokenParam = searchParams.get("token");
        const userIdParam = searchParams.get("user_id");

        if (tokenParam && userIdParam) {
            setToken(tokenParam);
            setUserId(Number(userIdParam));
        }
    }, [searchParams]);

    const newPassword = watch("new_password");

    const onSubmit = async (data) => {
        if (token && userId) {
            const result = await resetPassword({
                token,
                user_id: userId,
                new_password: data.new_password,
            });

            // Navigate to login page after successful reset
            if (result?.success) {
                setTimeout(() => {
                    navigate("/");
                }, 2000);
            }
        }
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
                        <h2 className="title">Reset Password</h2>
                        <p className="des">
                            Enter your new password to reset your account password.
                        </p>
                    </div>

                    <div className="form-content-wrap">
                        {/* FORM START */}
                        {!token || !userId ? (
                            <div className="error-message">
                                <p>Invalid or missing reset token. Please request a new password reset link.</p>
                                <Link to="/forget-password" className="link">
                                    Request New Reset Link
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit(onSubmit)}>
                                {/* PASSWORD */}
                                <div className="input-outer-wrap">
                                    <label className="label">New Password</label>
                                    <div className="input-wrap password-input-wrap">
                                        <input
                                            type={showNewPassword ? "text" : "password"}
                                            placeholder="Enter your new password"
                                            className="txt"
                                            {...register("new_password", {
                                                required: "Password is required",
                                                minLength: {
                                                    value: 6,
                                                    message: "Password must be at least 6 characters",
                                                },
                                            })}
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle"
                                            onClick={() => setShowNewPassword(!showNewPassword)}
                                            aria-label={showNewPassword ? "Hide password" : "Show password"}
                                        >
                                            {showNewPassword ? <FiEyeOff /> : <FiEye />}
                                        </button>

                                        {errors.new_password && (
                                            <div className="error">{errors.new_password.message}</div>
                                        )}
                                    </div>
                                </div>

                                {/* CONFIRM PASSWORD */}
                                <div className="input-outer-wrap">
                                    <label className="label">Confirm Password</label>
                                    <div className="input-wrap password-input-wrap">
                                        <input
                                            type={showConfirmPassword ? "text" : "password"}
                                            placeholder="Confirm your new password"
                                            className="txt"
                                            {...register("confirmPassword", {
                                                required: "Please confirm your password",
                                                validate: (value) =>
                                                    value === newPassword || "Passwords do not match",
                                            })}
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                        >
                                            {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                                        </button>

                                        {errors.confirmPassword && (
                                            <div className="error">{errors.confirmPassword.message}</div>
                                        )}
                                    </div>
                                </div>

                                {/* BUTTON */}
                                <div className="btn-wrap">
                                    <button className="btn-red" type="submit" disabled={isLoginLoading}>
                                        {isLoginLoading ? "Resetting..." : "Reset Password"}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    {/* BACK TO LOGIN */}
                    <div className="forgot-wrap">
                        <Link onClick={() => navigate("/")} className="link">
                            ← Back to Login
                        </Link>
                    </div>

                    <p className="copy">© Sedres 2025</p>
                </div>
            </div>
        </div>
    );
}

export default ResetPassword;
