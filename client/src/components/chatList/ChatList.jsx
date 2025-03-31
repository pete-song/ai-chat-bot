import { Link, useNavigate } from 'react-router-dom'
import './chatList.css'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash } from 'lucide-react';

const ChatList = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { isPending, error, data } = useQuery({
    queryKey: ['userChats'],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/api/userchats`, {
        credentials: "include"
      }
      ).then((res) =>
        res.json(),
      ),
  })

  const deleteChatMutation = useMutation({
    mutationFn: (chatId) => {
      fetch(`${import.meta.env.VITE_API_URL}/api/userchats/${chatId}`, {
        method: 'DELETE',
        credentials: "include",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['userChats']);
      navigate('/dashboard');
    },
  });

  const handleDelete = (chatId) => {
    console.log("deleting chatId:", chatId);
    deleteChatMutation.mutate(chatId);
  };

  return (
    <div className="chatList">
      <span className='title'>DASHBOARD</span>
      <Link to="/dashboard" className="chatItem">Create a new Chat</Link>
      <Link to="/" className="chatItem">Explore Nova AI</Link>
      <Link to="/" className="chatItem">Contact</Link>
      <hr />
      <span className='title'>RECENT CHATS</span>
      <div className="list">
        {isPending
          ? 'Loading...'
          : error
          ? 'Something went wrong!'
          : data?.map((chat) => (
              <div key={chat._id} className="chatItem">
                <Link to={`/dashboard/chats/${chat._id}`}>{chat.title}</Link>
                <button className="deleteButton" onClick={() => handleDelete(chat._id)}>
                  <Trash stroke="white" fill="none" size={20} />
                </button>
              </div>
            ))
        }
      </div>
      <hr />
      <div className="upgrade">
        <img src="/logo.png" alt="" />
        <div className="texts">
          <span>Upgrade to Nova AI Pro</span>
          <span>Get unlimited access to all features</span>
        </div>
      </div>
    </div>
  )
}

export default ChatList