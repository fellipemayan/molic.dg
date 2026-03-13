import { useState } from 'react';
import { ListIcon } from '@phosphor-icons/react';
import { Header } from './Header/Header';
import { DocumentationRenderer } from './Documentation/DocumentationRenderer';
import { TableOfContents } from './Documentation/TableOfContents';
import { parseMarkdownPage } from '../core/markdownParser';
import { documentationContent } from '../docs/content';
import { useIsMobile } from '../hooks/useIsMobile';
import './DocsPage.css';

type DocPageId = 'getting-started' | 'syntax-concepts' | 'recipes';

interface DocPageInfo {
  id: DocPageId;
  title: string;
  slug: string;
}

const docPages: DocPageInfo[] = [
  {
    id: 'getting-started',
    title: 'Começando',
    slug: 'getting-started'
  },
  {
    id: 'syntax-concepts',
    title: 'Sintaxe & Conceitos',
    slug: 'syntax-concepts'
  },
  {
    id: 'recipes',
    title: 'Exemplos Práticos',
    slug: 'recipes'
  }
];

export function DocsPage() {
  const [currentPage, setCurrentPage] = useState<DocPageId>('getting-started');
  const [showMobileIndex, setShowMobileIndex] = useState(false);
  const [isClosingMenu, setIsClosingMenu] = useState(false);
  const isMobile = useIsMobile();

  const currentPageContent = documentationContent[currentPage];
  const currentDocPage = docPages.find((page) => page.id === currentPage);
  
  const parsedPage = currentDocPage && currentPageContent
    ? parseMarkdownPage(currentPageContent, currentDocPage.id, currentDocPage.title, currentDocPage.slug)
    : null;

  const handleBackToEditor = () => {
    window.history.pushState({}, '', '/');
    window.dispatchEvent(new Event('navigationchange'));
  };

  const closeMenuWithAnimation = () => {
    setIsClosingMenu(true);
    setTimeout(() => {
      setShowMobileIndex(false);
      setIsClosingMenu(false);
    }, 300);
  };

  return (
    <div className="docs-page">
      <Header 
        onEditorClick={handleBackToEditor} 
        onDocsClick={() => {}} 
        showExport={false} 
        isDocsPage={true} 
      />

      <main className="docs-main">
        <aside className="docs-sidebar">
          <h3 className="sidebar-title">Documentação</h3>
          <nav className="sidebar-nav">
            {docPages.map((page) => (
              <button
                key={page.id}
                className={`sidebar-link ${currentPage === page.id ? 'active' : ''}`}
                onClick={() => setCurrentPage(page.id)}
              >
                {page.title}
              </button>
            ))}
          </nav>

          {parsedPage && (
            <div className="sidebar-content-index">
              <TableOfContents elements={parsedPage.elements} isInline={true} />
            </div>
          )}
        </aside>

        <div className="docs-content">
          {parsedPage && (
            <div className="docs-content-wrapper">
              <DocumentationRenderer elements={parsedPage.elements} />
            </div>
          )}
        </div>

        {isMobile && parsedPage && (
          <>
            {/* Overlay para fechar o menu */}
            {showMobileIndex && (
              <div
                className="docs-mobile-overlay"
                onClick={() => closeMenuWithAnimation()}
              />
            )}

            {/* Botão flutuante de sumário */}
            <button
              className="docs-mobile-summary-btn"
              onClick={() => {
                if (showMobileIndex) {
                  closeMenuWithAnimation();
                  return;
                }

                setShowMobileIndex(true);
              }}
              title={showMobileIndex ? 'Fechar sumário' : 'Abrir sumário'}
            >
              <ListIcon size={20} weight="bold" />
            </button>

            {/* Menu de sumário à esquerda */}
            {(showMobileIndex || isClosingMenu) && (
              <div className={`docs-mobile-summary-menu ${isClosingMenu ? 'closing' : ''}`}>
                <h3 className="sidebar-title">Documentação</h3>
                <nav className="sidebar-nav">
                  {docPages.map((page) => (
                    <button
                      key={page.id}
                      className={`sidebar-link ${currentPage === page.id ? 'active' : ''}`}
                      onClick={() => {
                        setCurrentPage(page.id);
                        closeMenuWithAnimation();
                      }}
                    >
                      {page.title}
                    </button>
                  ))}
                </nav>

                <div className="sidebar-content-index">
                  {parsedPage && (
                    <TableOfContents 
                      elements={parsedPage.elements} 
                      isInline={true}
                      onLinkClick={() => closeMenuWithAnimation()}
                    />
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
