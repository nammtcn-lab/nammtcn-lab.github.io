import { useStore } from '../store/store';
import { Editor, ToastView } from './Editor';
import { ProjectList } from './ProjectList';
import { ConfirmHost } from './confirm';

export function App() {
  const screen = useStore((s) => s.ui.screen);
  return (
    <>
      {screen === 'editor' ? <Editor /> : <ProjectList />}
      <ConfirmHost />
      <ToastView />
    </>
  );
}
