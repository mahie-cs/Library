# Contributing

If you only want a book added or removed, email **mahie.edu@gmail.com**.

## How the library is stored

- This repo (`Library`) is the website.
- The PDFs live in separate repos named `Library-books-1`, `Library-books-2`, `Library-books-3` and so on. Each one has GitHub Pages turned on, because GitHub allows only about 1 GB per Pages site.
- Every folder inside a books repo is a topic. If two repos have a folder with the same name, they are shown as one topic.

## Adding a book

1. Pick a books repo that still has room (keep each under about 700 MB) and put the PDF in the folder for its topic.
2. Name the file like this: `Authors - Title [Edition].pdf`

   ```
   Hennessy, Patterson - Computer Architecture A Quantitative Approach [4th Edition].pdf
   William Stallings - Computer Organization and Architecture, Designing for Performance [8th Edition].pdf
   ```

3. Push it with Git or GitHub Desktop. GitHub's website only accepts files up to 25 MB, and GitHub rejects any file over 100 MB.
4. The site updates within the hour. To update it right away, open the `Library` repo, go to Actions, choose "Update books.json and covers" and press Run workflow.

## Starting a new books repo

1. Create a public repo named `Library-books-4` (the next number).
2. In Settings → Pages, set the source to the main branch, root folder.
3. Add PDFs. The site finds the new repo by its name on the next update.

## Removing a book

Delete the PDF from its books repo and push. The next update removes it from the site and deletes its cover.

## Publishing the mobile app

1. In the `Library` repo, go to Releases and create a new release with a version tag such as `v1.0`.
2. Attach the `.apk` file and write the release notes in the description.
3. Publish it. The Download page shows the version tag, the file and the notes within a minute or two.

Only releases that have an `.apk` file appear on the Download page. If you add the file to a release that is already published, run the workflow by hand (Actions, then Run workflow) or wait for the hourly update.

## Setup for the Library repo

In Settings → Actions → General, set workflow permissions to "Read and write".

To build the list by hand instead:

```
pip install pymupdf
python3 generate_books.py mahie-cs/Library
```

Then commit `books.json`, `releases.json` and the `covers` folder. To test on your computer, run `python3 serve.py` and open `http://localhost:8000`.

## Notes

- File and folder names are case-sensitive on GitHub Pages.
