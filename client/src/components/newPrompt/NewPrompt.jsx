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
  }, [data, question, answer, img.dbData]);

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ question: q, answer: a, imgPath }) => {
      return fetch(`${import.meta.env.VITE_API_URL}/api/chats/${data._id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: q.length ? q : undefined,
          answer: a,
          role: "user",
          img: imgPath || undefined,
        }),
      }).then((res) => res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat", data._id] }).then(() => {
        formRef.current.reset();
        setQuestion("");
        setAnswer("");
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
        img: Object.entries(img.aiData).length ? img.aiData : null,
        history: Array.isArray(data?.history)
          ? data.history.map(({ role, parts }) => ({
              role,
              parts: [{ text: parts[0].text }],
            }))
          : [],
      };

      const res = await generateFromServer(payload);
      //  console.log("res: ", res.text);
      const result = res.text;
      setIsLoading(false);
      if (result) {
        setAnswer(result);
        mutation.mutate({
          question: isInitial ? undefined : text,
          answer: result,
          imgPath: img.dbData?.filePath || undefined,
        });
      } else {
        console.error("No reply from model:", result);
      }
    } catch (err) {
      console.error("Error communicating with backend:", err);
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
      {answer && (
        <div className="message">
          <Markdown>{answer}</Markdown>
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
