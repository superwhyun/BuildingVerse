---
trigger: always_on
---

- 파일의 변경이 생길 경우 반드시 commit 하되, push는 하지 않는다.
- 절대로 사용자가 시키지 않는 push는 하지 않는다.
- 사용자의 요구가 명시적으로 있을 경우에만, github에 push한다.
- github에 push 할때는 반드시 이전 push 이후의 commit 들을 squash를 한 이후에 진행한다. 즉, 그동안 쌓인 commit은 merge해서 하나로 올린다.