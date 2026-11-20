import { useStore } from '../store/store';
import { Editor } from './Editor';
import { ProjectList } from './ProjectList';

export function App() {
  const screen = useStore((s) => s.ui.screen);
  return screen === 'editor' ? <Editor /> : <ProjectList />;
}
