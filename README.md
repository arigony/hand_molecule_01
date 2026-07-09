# MolecuAR — Visualizador Molecular Ball-and-Stick

Objeto educacional interativo para visualização molecular 3D no navegador.

## Versão final

Esta versão foi organizada para publicação direta no GitHub Pages e padroniza todas as estruturas em **representação ball-and-stick**.

## Características

- Estruturas carregadas prioritariamente do **PubChem** por CID.
- Exemplos com CIDs fixos para evitar ambiguidade de busca.
- Representação visual única para todas as moléculas:
  - átomos como esferas;
  - ligações como bastões;
  - ligações simples, duplas e triplas diferenciadas;
  - cores atômicas padronizadas.
- Fallback local apenas para água, etanol e benzeno, caso o PubChem esteja indisponível.
- Busca por nome em inglês ou CID PubChem.
- Modo AR usando a câmera do navegador e rastreamento da mão com MediaPipe Hands.
- Layout responsivo para celular e computador.

## Arquivos

```text
index.html
style.css
script.js
README.md
```

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie os arquivos `index.html`, `style.css`, `script.js` e `README.md` para a raiz do repositório.
3. Vá em **Settings → Pages**.
4. Em **Build and deployment**, escolha:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Aguarde a publicação e acesse a URL do GitHub Pages.

## Observações técnicas

A página usa:

- Three.js via CDN;
- MediaPipe Hands via CDN;
- PubChem PUG REST API;
- JavaScript puro, sem build;
- CSS puro.

O modo AR/câmera exige HTTPS ou `localhost`. No GitHub Pages, o HTTPS já é fornecido automaticamente.

## Exemplos incluídos

| Molécula | CID PubChem |
|---|---:|
| Água | 962 |
| Etanol | 702 |
| Benzeno | 241 |
| Cafeína | 2519 |
| Aspirina | 2244 |
| Dopamina | 681 |
| Glicose | 5793 |
| Serotonina | 5202 |
| Adrenalina | 5816 |
| Vitamina C | 54670067 |
| CBD | 644019 |

## Uso didático sugerido

O professor pode pedir que os estudantes comparem:

- geometria molecular;
- presença de heteroátomos;
- grupos funcionais;
- ligações simples e duplas;
- diferenças entre moléculas pequenas e biomoléculas;
- relação entre estrutura molecular e propriedades químicas.

## Licença

Uso educacional livre, com crédito ao autor/projeto.


## Ajustes mobile-first

Esta versão inclui otimizações para celular:

- resolução de câmera reduzida no modo AR;
- `modelComplexity: 0` no MediaPipe Hands em dispositivos móveis;
- processamento do rastreamento com menor frequência para evitar travamentos;
- fallback por toque: arraste para girar e faça pinça para zoom quando a mão não for detectada;
- antialias e pixel ratio reduzidos em celulares para melhorar desempenho.


## Correção de enquadramento no celular

No modo AR em celular, a posição da molécula é ancorada em uma zona segura da tela.  
Isso evita que a estrutura saia do campo visual quando a mão se aproxima das bordas da câmera.

No celular:
- a mão controla rotação e escala;
- a posição permanece centralizada;
- o toque continua funcionando como fallback.


## Validação mais rigorosa da mão

Esta revisão corrige falsos positivos em celular.  
O sistema só aceita a mão quando há:

- confiança suficiente do MediaPipe Hands;
- palma e dedos em proporções plausíveis;
- mão suficientemente visível no quadro;
- pelo menos alguns frames estáveis.

Isso evita que rosto, óculos, orelha ou partes do ambiente sejam interpretados como mão.


## Versão robusta de detecção mobile

Nesta revisão, a validação da mão foi ajustada para celular:

- não rejeita mais a mão real por largura de palma muito grande ou pequena;
- usa limiares amplos e histerese temporal;
- aceita mão parcialmente enquadrada;
- mantém a molécula ancorada para evitar saída da tela;
- usa a geometria da mão apenas para rotação e escala.


## Revisão de rastreamento de mão

Esta versão substitui o rastreador antigo `@mediapipe/hands` pela API moderna **MediaPipe Tasks Vision HandLandmarker**, seguindo a abordagem do projeto de referência que funcionou melhor em smartphone.

Principais decisões técnicas:

- `@mediapipe/tasks-vision@0.10.34/vision_bundle.mjs`;
- modelo `hand_landmarker.task` float16;
- `delegate: CPU`, mais previsível em celulares;
- câmera frontal em baixa resolução no mobile (`320 × 240`) para maior estabilidade;
- `detectForVideo(video, performance.now())` em intervalo controlado;
- limiares baixos de detecção/presença/rastreamento (`0.2`), como no projeto de referência;
- sem rejeição rígida por largura da palma;
- molécula ancorada no celular para não sair da tela;
- mão controla rotação e escala; toque continua como fallback.

Para diagnóstico, abra a página com `?debug=1` para visualizar os pontos da mão sobre a câmera.
