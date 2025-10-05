import { Link, useLocation } from "react-router-dom";
import "./chatList.scss";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SignedIn, UserButton } from "@clerk/clerk-react";

const ChatList = () => {
  const { pathname } = useLocation();

  const queryClient = useQueryClient();
  const { isPending, error, data } = useQuery({
    queryKey: ["userChats"],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/api/userchats`, {
        credentials: "include",
      }).then((res) => res.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (chatId) =>
      fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}`, {
        method: "DELETE",
        credentials: "include",
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userChats"] });
    },
  });

  return (
    <aside className="sidemenu">
      <Link to="/" className="logo">
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3">
          <path d="M600-360ZM320-242q10 1 19.5 1.5t20.5.5q11 0 20.5-.5T400-242v82h400v-400h-82q1-10 1.5-19.5t.5-20.5q0-11-.5-20.5T718-640h82q33 0 56.5 23.5T880-560v400q0 33-23.5 56.5T800-80H400q-33 0-56.5-23.5T320-160v-82Zm40-78q-117 0-198.5-81.5T80-600q0-117 81.5-198.5T360-880q117 0 198.5 81.5T640-600q0 117-81.5 198.5T360-320Zm0-80q83 0 141.5-58.5T560-600q0-83-58.5-141.5T360-800q-83 0-141.5 58.5T160-600q0 83 58.5 141.5T360-400Zm0-200Z" />
        </svg>
        <span>PsyPal AI</span>
      </Link>
      <span className="title">DASHBOARD</span>
      <Link to="/dashboard">Create a new Chat</Link>
      <Link to="/">Explore PsyPal AI</Link>
      <Link to="/">Contact</Link>
      <hr />
      <span className="title">RECENT CHATS</span>
      <div className="list">
        {isPending
          ? "Loading..."
          : error
          ? "Something went wrong!"
          : Array.isArray(data) &&
            data.map((chat) => (
              <div key={chat._id} className={`chat-item ${pathname.includes(chat._id) ? "active" : ""}`}>
                <Link to={`/dashboard/chats/${chat._id}`} style={{ flex: 1 }}>
                  {chat.title}
                </Link>
                <button className="delete-button" onClick={() => deleteMutation.mutate(chat._id)} title="Delete chat">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e3e3e3">
                    <path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
                  </svg>
                </button>
              </div>
            ))}
      </div>
      <hr />
      <div className="bottom">
        <div className="user">
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
        <div className="upgrade">
          <div className="texts">
            <span>Upgrade to PsyPal AI Pro</span>
            <span>Get unlimited access to all features</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default ChatList;
