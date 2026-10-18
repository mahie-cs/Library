# Contributing

 You want to contribute to this project? Email **mahie.edu@gmail.com**.

## Adding a book

1. Put the PDF in the `books` folder. Each folder inside `books` is a topic, so put the book in the folder for its subject. A new folder makes a new topic.
2. Name the file like this: `Authors - Title [Edition].pdf`

   ```
   Hennessy, Patterson - Computer Architecture A Quantitative Approach [4th Edition].pdf
   William Stallings - Computer Organization and Architecture, Designing for Performance [8th Edition].pdf
   ```

3. Push to GitHub. The workflow in `.github/workflows` updates `books/books.json` and the `covers` folder automatically.

## Updating by hand

If you don't use the workflow, run this before you push:

```
pip install pymupdf
python3 generate_books.py
```

Then commit the new `books/books.json` and the `covers` folder.

## Removing a book

Delete the PDF and push. The workflow removes it from the list and deletes its cover. Do discuss with me before deleting.

## Notes

- GitHub rejects files over 100 MB. Larger books need Git LFS.
- File and folder names are case-sensitive on GitHub Pages.
- To test on your computer, run `python3 serve.py` and open `http://localhost:8000`.
