import { useEffect, useRef, useState } from "react";
import "./newPrompt.scss";
import Upload from "../upload/Upload";
import { IKImage } from "imagekitio-react";
import Markdown from "react-markdown";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateFromServer } from "../../lib/gemini";

const NewPrompt = ({ data }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState();
  const [therapistAnswer, setTherapistAnswer] = useState();
  const [friendAnswer, setFriendAnswer] = useState();
  const [chosenFromBoth, setChosenFromBoth] = useState(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [img, setImg] = useState({
    isLoading: false,
    error: "",
    dbData: {},
    aiData: {},
  });

  const endRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    endRef?.current?.scrollIntoView({ behavior: "smooth" });
  }, [data, question, answer, therapistAnswer, friendAnswer, img.dbData]);

  const queryClient = useQueryClient();

  const updateAssistantMutation = useMutation({
    mutationFn: (newAssistant) => {
      return fetch(`${import.meta.env.VITE_API_URL}/api/chats/${data._id}/assistant`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ chosenAssistant: newAssistant }),
      }).then((res) => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", data._id] });
    },
  });

  const mutation = useMutation({
    mutationFn: ({ text: q = "", answer: a, imgPath }) => {
      return fetch(`${import.meta.env.VITE_API_URL}/api/chats/${data._id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: q?.length ? q : undefined,
          answer: a,
          role: "user",
          chosenAssistant: data.chosenAssistant,
          img: imgPath || undefined,
        }),
      }).then(async (res) => {
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Server error ${res.status}: ${txt}`);
        }
        return res.json();
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", data._id] }).then(() => {
        formRef.current.reset();
        setQuestion("");
        setAnswer("");
        setTherapistAnswer("");
        setFriendAnswer("");
        setImg({
          isLoading: false,
          error: "",
          dbData: {},
          aiData: {},
        });
      });
    },
    onError: (err) => {
      console.log(err);
    },
  });

  const add = async (text, isInitial) => {
    setIsLoading(true);
    if (!isInitial) setQuestion(text);

    try {
      const payload = {
        prompt: text,
        chosenAssistant: data.chosenAssistant,
        img: Object.entries(img.aiData)?.length ? img.aiData : null,
        history: Array.isArray(data?.history)
          ? data.history.map(({ role, parts }) => ({
              role,
              parts: [{ text: parts[0].text }],
            }))
          : [],
      };

      const res = await generateFromServer(payload);
      setIsLoading(false);

      // Check if response is for "Both" mode
      if (res.mode === "both") {
        const therapistText = res.therapist?.text;
        const friendText = res.friend?.text;

        if (therapistText && friendText) {
          setTherapistAnswer(therapistText);
          setFriendAnswer(friendText);

          // Store both responses in history
          mutation.mutate({
            text: isInitial ? undefined : text,
            answer: `**Therapist:** ${therapistText}\n\n**Friend:** ${friendText}`,
            imgPath: img.dbData?.filePath || undefined,
          });
        } else {
          console.error("No reply from one or both models");
        }
      } else {
        // Single assistant mode
        const result = res.text;
        if (result) {
          setAnswer(result);
          mutation.mutate({
            text: isInitial ? undefined : text,
            answer: result,
            imgPath: img.dbData?.filePath || undefined,
          });
        } else {
          console.error("No reply from model:", result);
        }
      }
    } catch (err) {
      console.error("Error communicating with backend:", err);
    }
  };

  const handleChooseAssistant = (assistant) => {
    setChosenFromBoth(assistant);
    updateAssistantMutation.mutate(assistant);

    // Keep only the chosen assistant's answer
    if (assistant === "Therapist") {
      setAnswer(therapistAnswer);
      setFriendAnswer(null);
    } else {
      setAnswer(friendAnswer);
      setTherapistAnswer(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!inputText.trim()) return;
    add(inputText, false);
    setInputText("");
  };

  // IN PRODUCTION WE DON'T NEED IT
  const hasRun = useRef(false);
  useEffect(() => {
    if (!hasRun.current) {
      if (data?.history?.length === 1) {
        add(data.history[0].parts[0].text, true);
      }
    }
    hasRun.current = true;
  }, []);

  return (
    <>
      {img.isLoading && <div>Loading...</div>}
      {img.dbData?.filePath && <IKImage urlEndpoint={import.meta.env.VITE_IMAGE_KIT_ENDPOINT} path={img.dbData?.filePath} width="380" transformation={[{ width: 380 }]} />}
      {question && <div className="message user">{question}</div>}

      {/* Single assistant response */}
      {answer && !therapistAnswer && !friendAnswer && (
        <div className="message">
          <Markdown>{answer}</Markdown>
        </div>
      )}

      {/* Both assistants response - side by side */}
      {(therapistAnswer || friendAnswer) && !chosenFromBoth && (
        <div className="both-responses">
          {therapistAnswer && (
            <div className="response-column therapist">
              <div className="response-header">Psychiatrist (Benny)</div>
              <div className="message">
                <Markdown>{therapistAnswer}</Markdown>
              </div>
              <button className="choose-btn therapist-btn" onClick={() => handleChooseAssistant("Therapist")}>
                Choose Psychiatrist
              </button>
            </div>
          )}
          {friendAnswer && (
            <div className="response-column friend">
              <div className="response-header">Best Friend (Anna)</div>
              <div className="message">
                <Markdown>{friendAnswer}</Markdown>
              </div>
              <button className="choose-btn friend-btn" onClick={() => handleChooseAssistant("Friend")}>
                Choose Best Friend
              </button>
            </div>
          )}
        </div>
      )}

      <div className="endChat" ref={endRef}></div>

      <form className="newForm" onSubmit={handleSubmit} ref={formRef} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSubmit(e)}>
        <Upload setImg={setImg} />
        {isLoading && (
          <div className="typing">
            <div className="loader"></div>
          </div>
        )}
        <input id="file" type="file" multiple={false} hidden />
        <input type="text" name="text" placeholder="Ask anything..." value={inputText} onChange={(e) => setInputText(e.target.value)} />
        <button disabled={isLoading} type="submit">
          <img src="/arrow.png" alt="arrow" />
        </button>
      </form>
    </>
  );
};

export default NewPrompt;
