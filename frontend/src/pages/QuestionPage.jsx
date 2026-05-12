import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { getActiveQuestionLists } from "../api/questions";
import { getMyResponses, submitResponse } from "../api/responses";
import { getSessionByCode, getSessionProgress } from "../api/sessions";
import aucklandSkyBackground from "../assets/background - auckland - sky transparent 1.png";
import loadingIllustration from "../assets/loading 1.png";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/useAuth";
import "./QuestionPage.css";

function QuestionPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { sessionCode } = useParams();
    const initialSession = location.state?.inviteSession || null;
    const { isAuthenticated, isAuthReady, token } = useAuth();
    const [session, setSession] = useState(initialSession);
    const [questions, setQuestions] = useState([]);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [errorMessage, setErrorMessage] = useState("");
    const [isLoading, setIsLoading] = useState(!location.state?.inviteSession);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isComplete, setIsComplete] = useState(false);
    const [progress, setProgress] = useState(null);
    const [selectedOptionId, setSelectedOptionId] = useState("");
    const [selectedOptionIds, setSelectedOptionIds] = useState([]);
    const [textAnswer, setTextAnswer] = useState("");

    const currentQuestion = questions[currentQuestionIndex] || null;
    const isGeneratingRestaurants = isComplete || session?.status === "generating";
    const questionTypeHint =
        currentQuestion?.questionType === "multiple_choice"
            ? "Multiple choice"
            : currentQuestion?.questionType === "text"
                ? "Text"
                : currentQuestion
                    ? "Single choice"
                    : "";

    useEffect(() => {
        if (isAuthReady && !isAuthenticated) {
            navigate("/auth", {
                replace: true,
                state: { redirectTo: location.pathname },
            });
        }
    }, [isAuthReady, isAuthenticated, location.pathname, navigate]);

    useEffect(() => {
        if (!isAuthReady || !isAuthenticated || !token) {
            return;
        }

        let ignore = false;

        getActiveQuestionLists(token)
            .then(({ questionLists }) => {
                if (ignore) {
                    return;
                }

                const nextQuestions = questionLists.flatMap((questionList) =>
                    questionList.questionList.map((question) => ({
                        ...question,
                        category: questionList.category,
                        questionListId: questionList.questionListId,
                    }))
                );

                setQuestions(nextQuestions);
                setCurrentQuestionIndex(0);
            })
            .catch((error) => {
                if (!ignore) {
                    setErrorMessage(error.message);
                }
            });

        return () => {
            ignore = true;
        };
    }, [isAuthReady, isAuthenticated, token]);

    useEffect(() => {
        if (!isAuthReady || !isAuthenticated || !token || !sessionCode) {
            return;
        }

        let ignore = false;

        async function loadSession(options = {}) {
            const { showLoader = false } = options;

            if (showLoader) {
                setIsLoading(true);
            }

            try {
                const { session: nextSession } = await getSessionByCode(token, sessionCode);

                if (ignore) {
                    return;
                }

                setSession(nextSession);
                setErrorMessage("");
            } catch (error) {
                if (!ignore) {
                    setErrorMessage(error.message);
                }
            } finally {
                if (!ignore && showLoader) {
                    setIsLoading(false);
                }
            }
        }

        loadSession({ showLoader: !initialSession });
        const intervalId = window.setInterval(() => {
            loadSession();
        }, 3000);

        return () => {
            ignore = true;
            window.clearInterval(intervalId);
        };
    }, [initialSession, isAuthReady, isAuthenticated, sessionCode, token]);

    useEffect(() => {
        if (session?.status === "waiting") {
            navigate(`/sessions/${session.sessionCode}`, {
                replace: true,
                state: { inviteSession: session },
            });
        }
    }, [navigate, session]);

    useEffect(() => {
        if (!session || !["generating", "selecting"].includes(session.status)) {
            return;
        }

        navigate(`/sessions/${session.sessionCode}/recommendation`, {
            replace: true,
            state: { inviteSession: session },
        });
    }, [navigate, session]);

    useEffect(() => {
        setSelectedOptionId("");
        setSelectedOptionIds([]);
        setTextAnswer("");
    }, [currentQuestion]);

    useEffect(() => {
        if (!isAuthReady || !isAuthenticated || !token || !session?.id || questions.length === 0) {
            return;
        }

        let ignore = false;

        async function restoreQuestionProgress() {
            try {
                const { responses } = await getMyResponses(token, session.id);

                if (ignore) {
                    return;
                }

                const nextQuestionIndex = responses.length;

                if (nextQuestionIndex >= questions.length) {
                    setIsComplete(true);
                    setCurrentQuestionIndex(questions.length - 1);
                    return;
                }

                setIsComplete(false);
                setCurrentQuestionIndex(nextQuestionIndex);
            } catch (error) {
                if (!ignore) {
                    setErrorMessage(error.message);
                }
            }
        }

        void restoreQuestionProgress();

        return () => {
            ignore = true;
        };
    }, [isAuthReady, isAuthenticated, questions, session?.id, token]);

    useEffect(() => {
        if (!isGeneratingRestaurants || !session?.id || !token) {
            return;
        }

        let ignore = false;

        async function loadProgress() {
            try {
                const { progress: nextProgress } = await getSessionProgress(token, session.id);

                if (ignore) {
                    return;
                }

                setProgress(nextProgress);
            } catch (error) {
                if (!ignore) {
                    setErrorMessage(error.message);
                }
            }
        }

        loadProgress();

        if (progress?.allComplete) {
            return () => {
                ignore = true;
            };
        }

        const intervalId = window.setInterval(() => {
            loadProgress();
        }, 3000);

        return () => {
            ignore = true;
            window.clearInterval(intervalId);
        };
    }, [isGeneratingRestaurants, progress?.allComplete, session?.id, token]);

    function toggleMultipleChoice(optionId) {
        setSelectedOptionIds((current) =>
            current.includes(optionId) ? current.filter((value) => value !== optionId) : [...current, optionId]
        );
    }

    async function handleAdvanceQuestion({ skipped = false } = {}) {
        if (!currentQuestion || !session || !token || isSubmitting) {
            return;
        }

        let answer = "";

        if (currentQuestion.questionType === "text") {
            answer = textAnswer.trim();
        } else if (currentQuestion.questionType === "multiple_choice") {
            answer = (currentQuestion.questionValue || [])
                .filter((option) => selectedOptionIds.includes(option.optionLabel || option.optionText))
                .map((option) => option.optionText)
                .join(", ");
        } else {
            const selectedOption = (currentQuestion.questionValue || []).find(
                (option) => (option.optionLabel || option.optionText) === selectedOptionId
            );
            answer = selectedOption?.optionText || "";
        }

        if (!skipped && !answer) {
            setErrorMessage("Please choose an option or skip this question.");
            return;
        }

        setErrorMessage("");
        setIsSubmitting(true);

        try {
            await submitResponse(token, {
                sessionId: session.id,
                questionId: currentQuestion.questionId,
                answer,
                skipped,
            });

            const isLastQuestion = currentQuestionIndex >= questions.length - 1;

            if (isLastQuestion) {
                setIsComplete(true);
                return;
            }

            setCurrentQuestionIndex((currentIndex) => currentIndex + 1);
        } catch (error) {
            setErrorMessage(error.message);
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!isAuthReady) {
        return <main className="question-page-shell question-page-status">Restoring session...</main>;
    }

    return (
        <main className="question-page-shell">
            <section className="question-screen-frame">
                <div
                    className="question-page-background"
                    aria-hidden="true"
                    style={{ "--create-room-background-image": `url("${aucklandSkyBackground}")` }}
                />

                <Navbar className="question-page-banner" />

                {isGeneratingRestaurants ? (
                    <section className="question-finished-state">
                        <img className="question-finished-illustration" src={loadingIllustration} alt="" aria-hidden="true" />
                        <div className="question-finished-dots" aria-hidden="true">
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                            <span />
                        </div>
                        <p>
                            {session?.status === "generating" || progress?.allComplete
                                ? "Finding great places for your team ..."
                                : `${progress?.pendingCount ?? "..." } people still need to finish their quiz.`}
                        </p>
                    </section>
                ) : (
                    <section className="question-page-body">
                        <div className="question-page-copy">
                            <h1>Quick check first:</h1>
                            <div className="question-page-rule" aria-hidden="true" />
                            <h2>
                                Q{currentQuestionIndex + 1} - {currentQuestion?.questionText || "Loading question..."}
                            </h2>
                            {questionTypeHint ? (
                                <p className="question-type-hint">{questionTypeHint}</p>
                            ) : null}
                        </div>

                        {isLoading ? <p className="account-dropdown-state">Loading session...</p> : null}
                        {errorMessage ? <p className="auth-status error">{errorMessage}</p> : null}

                        {currentQuestion?.questionType === "text" ? (
                            <div className="question-text-answer">
                <textarea
                    value={textAnswer}
                    onChange={(event) => setTextAnswer(event.target.value)}
                    placeholder="Type your answer here..."
                />
                            </div>
                        ) : (
                            <div className="question-option-list" role="list">
                                {(currentQuestion?.questionValue || []).map((option) => {
                                    const optionId = option.optionLabel || option.optionText;
                                    const isSelected =
                                        currentQuestion.questionType === "multiple_choice"
                                            ? selectedOptionIds.includes(optionId)
                                            : optionId === selectedOptionId;

                                    return (
                                        <button
                                            key={optionId}
                                            className={`question-option-card${isSelected ? " selected" : ""}`}
                                            type="button"
                                            onClick={() =>
                                                currentQuestion.questionType === "multiple_choice"
                                                    ? toggleMultipleChoice(optionId)
                                                    : setSelectedOptionId(optionId)
                                            }
                                        >
                      <span className="question-option-icon" aria-hidden="true">
                        {option.optionLabel || "•"}
                      </span>
                                            <span>{option.optionText}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        <div className="question-page-actions">
                            <button
                                className="question-page-action secondary"
                                type="button"
                                onClick={() => handleAdvanceQuestion({ skipped: true })}
                                disabled={isSubmitting}
                            >
                                Skip this question
                            </button>
                            <button
                                className="question-page-action"
                                type="button"
                                onClick={() => handleAdvanceQuestion()}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? "Saving..." : "Next"}
                            </button>
                        </div>
                    </section>
                )}

            </section>
        </main>
    );
}

export default QuestionPage;
