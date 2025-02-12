import os
from getpass import getpass
import dotenv
dotenv.load_dotenv()

import phoenix as px
from phoenix.trace.dsl import SpanQuery
from phoenix.trace import SpanEvaluations
from phoenix.evals import llm_classify, OpenAIModel
import json
def setup_openai_key():
    if not (openai_api_key := os.getenv("OPENAI_API_KEY")):
        openai_api_key = getpass("🔑 Enter your OpenAI API key: ")
    os.environ["OPENAI_API_KEY"] = openai_api_key

def get_song_relevance_spans():
    query = SpanQuery().where(
        "name == 'mood_match_app'",
    ).select(
        input="input.value",
        output="output.value",
    )
    
    spans_df = px.Client().query_spans(query, project_name="MoodMatch")
    return spans_df


def get_output_format_spans():
    query = SpanQuery().where(
        "span_kind == 'LLM' and 'Based on this analysis of what creates a' in input.value",
    ).select(
        formatted_output="llm.output_messages",
    )
    spans_df = px.Client().query_spans(query, project_name="MoodMatch")
    spans_df['formatted_output'] = spans_df['formatted_output'].apply(lambda x: x[0].get('message').get('content'))
    return spans_df

def evaluate_output_format(spans_df):
    OUTPUT_FORMAT_PROMPT = """
    You are a judge evaluating the output of an LLM.
    
    Does the output follow the format specified below?

    Output format:
    Song Title - Artist - Genre1, Genre2
    
    Respond only with "correct" or "incorrect", and a short explanation for your answer.
    
    Here is the output:
    {formatted_output}
    
    Your answer should be in the following format:
    Score: [score]
    Explanation: [explanation]
    """
    
    judge_model = OpenAIModel(model="gpt-4o-mini")
    eval_df = llm_classify(
        data=spans_df,
        model=judge_model,
        template=OUTPUT_FORMAT_PROMPT,
        rails=["correct", "incorrect"],
        concurrency=10,
        provide_explanation=True,
    )
    eval_df['score'] = eval_df['label'].map({"correct": 1, "incorrect": 0})
    return eval_df

def evaluate_recommendations(spans_df):
    RELEVANCE_PROMPT = """
    You are a music recommendation expert. You are given a mood and a list of songs that match the mood.
    You need to determine if the list of songs is relevant to the mood.

    Rate relevance on a scale of 1 to 5, where 1 is not relevant and 5 is very relevant.
    1 is not relevant at all, 2 means the tracks are somewhat relevant to the mood,
    3 is relevant, 4 is very relevant, 5 means these tracks are the epitome of the mood.
    
    Only respond with the score, and a short explanation for your score.

    Here is the mood:
    {input}

    Here is the list of songs:
    {output}
    
    Output format:
    Score: [score]
    Explanation: [explanation]
    """

    judge_model = OpenAIModel(model="gpt-4o-mini")
    eval_df = llm_classify(
        data=spans_df,
        model=judge_model,
        template=RELEVANCE_PROMPT,
        rails=["1", "2", "3", "4", "5"],
        concurrency=10,
        provide_explanation=True,
    )
    eval_df['score'] = eval_df['label'].astype(int)
    eval_df['label'] = eval_df['score'].map({1: "1", 2: "2", 3: "3", 4: "4", 5: "5"})
    return eval_df

def log_evaluation_results(eval_df, eval_name):
    px.Client().log_evaluations(SpanEvaluations(eval_name=eval_name, dataframe=eval_df))

def main():
    setup_openai_key()
    output_format_spans_df = get_output_format_spans()
    output_format_eval_df = evaluate_output_format(output_format_spans_df)
    log_evaluation_results(output_format_eval_df, "Output Format")
    
    song_relevance_spans_df = get_song_relevance_spans()
    song_relevance_eval_df = evaluate_recommendations(song_relevance_spans_df)
    log_evaluation_results(song_relevance_eval_df, "Song Relevance")

if __name__ == "__main__":
    main()