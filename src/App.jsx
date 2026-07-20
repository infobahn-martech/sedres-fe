import 'react-toastify/dist/ReactToastify.css';
import './design/scss/common.scss';
import './design/scss/modal-backdrop-dark.scss';

import { Outlet } from 'react-router-dom';

import { ToastContainer, Zoom } from 'react-toastify';

import Toaster from './components/Toaster';

function App() {
  return (
    <>
      <ToastContainer
        closeButton
        transition={Zoom}
        icon={false}
        theme="light"
      />
      <Toaster />
      <Outlet />
    </>
  );
}

export default App;
